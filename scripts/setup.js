#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const cliArgs = process.argv.slice(2);
const isAuto = cliArgs.includes('--yes') || cliArgs.includes('-y') || !process.stdin.isTTY;
const isDryRun = cliArgs.includes('--dry-run');

const rl = isAuto
  ? null
  : readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

function ask(question, defaultValue = '') {
  if (isAuto) {
    return Promise.resolve(defaultValue);
  }
  return new Promise((resolve) => {
    const promptText = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(promptText, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function getClaudeConfigPath() {
  const platform = os.platform();
  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Claude', 'claude_desktop_config.json');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else {
    return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('   BlindWrite MCP — Streamlined Setup & Config Wizard   ');
  console.log('======================================================\n');

  // 1. Ensure build exists
  const distIndex = path.join(projectRoot, 'dist', 'index.js');
  if (!fs.existsSync(distIndex)) {
    console.log('📦 Project not built yet. Running "npm run build"...');
    try {
      execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });
      console.log('✅ Build completed successfully.\n');
    } catch (err) {
      console.error('❌ Build failed. Please run "npm run build" manually and fix any errors.');
      process.exit(1);
    }
  }

  // 2. Resolve Paths
  const dbPath = path.join(projectRoot, 'data', 'blindwrite.sqlite');
  console.log(`📂 Project Root : ${projectRoot}`);
  console.log(`🚀 Executable   : ${distIndex}`);
  console.log(`💾 Database Path: ${dbPath}\n`);

  // Ensure data directory exists
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 3. API Key check
  const envPath = path.join(projectRoot, '.env');
  let existingKey = '';
  const apiKeyFlag = cliArgs.find((a) => a.startsWith('--api-key='));
  const envApiKey = apiKeyFlag ? apiKeyFlag.split('=')[1].trim() : process.env.OPENROUTER_API_KEY;

  if (envApiKey && !envApiKey.includes('your-openrouter-key')) {
    existingKey = envApiKey.trim();
  } else if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^OPENROUTER_API_KEY=(.+)$/m);
    if (match && match[1] && !match[1].includes('your-openrouter-key')) {
      existingKey = match[1].trim();
    }
  }

  let apiKey = existingKey;
  if (existingKey) {
    const masked = existingKey.slice(0, 8) + '...' + existingKey.slice(-4);
    if (isAuto) {
      apiKey = existingKey;
    } else {
      const useExisting = await ask(`Found OpenRouter API key (${masked}). Use it? (Y/n)`, 'Y');
      if (useExisting.toLowerCase() !== 'y') {
        apiKey = await ask('Enter your new OpenRouter API Key (sk-or-v1-...)');
      }
    }
  } else {
    apiKey = await ask('Enter your OpenRouter API Key (sk-or-v1-...)');
  }

  if (!apiKey || apiKey.includes('your-openrouter-key')) {
    console.warn('\n⚠️ Warning: No valid OpenRouter API key provided. Model generation will require setting OPENROUTER_API_KEY.\n');
  }

  // Write .env
  const envContent = `# BlindWrite MCP Environment Configuration
OPENROUTER_API_KEY=${apiKey}
DB_PATH=${dbPath}
LOG_LEVEL=info
`;
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log(`✅ Updated local environment file: ${envPath}\n`);

  // 4. Construct MCP server configuration
  const blindwriteConfig = {
    command: 'node',
    args: [distIndex],
    env: {
      OPENROUTER_API_KEY: apiKey,
      DB_PATH: dbPath,
      LOG_LEVEL: 'info',
    },
  };

  const claudeConfigPath = getClaudeConfigPath();
  console.log(`🔍 Detected Claude Desktop config location:`);
  console.log(`   ${claudeConfigPath}\n`);

  const autoInstall = await ask('Would you like to automatically configure Claude Desktop now? (Y/n)', 'Y');
  let currentConfig = { mcpServers: {} };
  if (autoInstall.toLowerCase() === 'y') {
    try {
      const configDir = path.dirname(claudeConfigPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      if (fs.existsSync(claudeConfigPath)) {
        try {
          const raw = fs.readFileSync(claudeConfigPath, 'utf8');
          currentConfig = JSON.parse(raw);
          if (!currentConfig.mcpServers) {
            currentConfig.mcpServers = {};
          }

          // Create backup
          const backupPath = `${claudeConfigPath}.bak.${Date.now()}`;
          fs.writeFileSync(backupPath, raw, 'utf8');
          console.log(`📋 Created backup of existing config at: ${backupPath}`);
        } catch {
          console.warn('⚠️ Could not parse existing Claude Desktop config. Creating fresh backup.');
        }
      }

      currentConfig.mcpServers.blindwrite = blindwriteConfig;

      fs.writeFileSync(claudeConfigPath, JSON.stringify(currentConfig, null, 2), 'utf8');
      console.log(`\n🎉 SUCCESS! BlindWrite MCP was added to Claude Desktop configuration.\n`);
    } catch (err) {
      console.error(`❌ Failed to automatically write Claude Desktop config: ${String(err)}`);
    }
  }

  // 5. Automatically install Skill for Claude Desktop & Claude Code
  const skillDir = path.join(projectRoot, 'skills', 'writing-orchestrator');
  const skillSource = path.join(skillDir, 'SKILL.md');
  const zipPath = path.join(projectRoot, 'skills', 'writing-orchestrator.zip');

  function packageSkillZip(sourceDir, targetZip) {
    try {
      if (process.platform === 'win32') {
        execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${sourceDir}' -DestinationPath '${targetZip}' -Force"`, { stdio: 'ignore' });
      } else {
        const parent = path.dirname(sourceDir);
        const base = path.basename(sourceDir);
        execSync(`cd "${parent}" && zip -r -q "${targetZip}" "${base}"`, { stdio: 'ignore' });
      }
      return fs.existsSync(targetZip);
    } catch {
      return false;
    }
  }

  if (fs.existsSync(skillSource)) {
    const home = os.homedir();
    const claudeDir = path.dirname(claudeConfigPath);
    
    // Dedicated Claude Desktop and Claude Code skill directories
    const targetSkillDirs = [
      path.join(claudeDir, 'skills', 'writing-orchestrator'),
      path.join(home, '.claude', 'skills', 'writing-orchestrator'),
      path.join(projectRoot, '.claude', 'skills', 'writing-orchestrator'),
    ];

    if (currentConfig.coworkUserFilesPath) {
      targetSkillDirs.push(path.join(currentConfig.coworkUserFilesPath, 'skills', 'writing-orchestrator'));
    }

    let installedCount = 0;
    for (const dir of targetSkillDirs) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const targetFile = path.join(dir, 'SKILL.md');
        fs.copyFileSync(skillSource, targetFile);
        console.log(`📋 Auto-installed skill file: ${targetFile}`);
        installedCount++;
      } catch {
        // Non-fatal if folder not writable
      }
    }

    const packaged = packageSkillZip(skillDir, zipPath);
    if (packaged) {
      console.log(`📦 Created Claude Desktop uploadable ZIP: ${zipPath}`);
    }

    if (installedCount > 0 || packaged) {
      console.log('✅ writing-orchestrator skill prepared successfully for Claude Desktop & Claude Code!\n');
    }
  }

  console.log('\n------------------------------------------------------');
  console.log('   Ready-to-use Claude Desktop Configuration Snippet  ');
  console.log('------------------------------------------------------\n');
  console.log(JSON.stringify({ mcpServers: { blindwrite: blindwriteConfig } }, null, 2));

  console.log('\n👉 Next steps:');
  console.log('1. Restart Claude Desktop completely (Quit from tray/menu and relaunch).');
  console.log('2. Look for the 🔨 icon in Claude Desktop chat (11 tools available).');
  console.log('3. Three ways to use the Writing Orchestrator:');
  console.log('   • Native MCP Prompt (Easiest): Type /writing-orchestrator in Claude Desktop chat.');
  console.log('   • Claude Account Skill: In Claude Desktop, go to Customize > Skills > "+" > "Upload a skill",');
  console.log(`     and select: ${zipPath}`);
  console.log('   • Project Custom Instructions: Copy CLAUDE_PROMPT.md into your Claude Desktop Project.');
  console.log('4. Token-Saving Writing: "Help me write a cold email — outline the strategy and use writer_generate to draft it!"');
  console.log('5. Blind Benchmarking: "Benchmark competing writing models for my sales pitch!"\n');

  if (rl) rl.close();
}

main().catch((err) => {
  console.error('Fatal error in setup:', err);
  if (rl) rl.close();
  process.exit(1);
});
