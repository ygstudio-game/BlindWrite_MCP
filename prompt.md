Build Prompt: BlindWrite MCP

You are a senior MCP engineer, backend architect, and AI evaluation systems engineer.

Build a production-ready Model Context Protocol (MCP) server called BlindWrite MCP for use inside Claude Desktop.

1. Product Concept

BlindWrite MCP is a blind AI writing benchmark.

The user interacts with the system through Claude Desktop. Claude uses the MCP server to:

Create writing benchmark tasks.
Select competing AI models through OpenRouter.
Send the same prompt to multiple models.
Randomize and anonymize their outputs.
Present blind A/B comparisons to the user.
Collect the user's preference votes.
Calculate model rankings.
Track the user's personal preferences.
Compare personal rankings with global rankings.
Analyze why particular models perform better for that user.

The user must NOT know which model produced an answer until the appropriate reveal stage.

The goal is to determine:

"Which AI writing model is actually best for me?"

rather than simply relying on public model benchmarks.

2. Core Architecture

Build the system around this architecture:

Claude Desktop
│
│ MCP
▼
┌─────────────────────────┐
│ BlindWrite MCP │
│ MCP Server │
├─────────────────────────┤
│ Benchmark Engine │
│ Model Registry │
│ Blind Randomization │
│ Voting Engine │
│ Ranking Engine │
│ Preference Analytics │
│ Cost Tracking │
│ Persistence │
└────────────┬────────────┘
│
▼
OpenRouter
│
┌─────┼─────┐
▼ ▼ ▼
Model A Model B Model C
... ... ...

The MCP server is the main application backend.

Claude Desktop is the primary client.

OpenRouter is the model gateway.

3. Recommended Technology

Use:

TypeScript
Node.js
Official MCP TypeScript SDK
OpenRouter API
SQLite for the initial database
Zod for schema validation
dotenv for configuration
Vitest for testing

Keep the architecture modular so SQLite can later be replaced by PostgreSQL.

Use environment variables for secrets.

Never hardcode API keys.

4. MCP Tools

Implement these MCP tools.

benchmark_create_task

Creates a benchmark task.

Input:

title
category
prompt
optional evaluation criteria
optional difficulty
optional model list

Output:

task_id
task metadata
benchmark_list_models

Returns the models currently available to the benchmark.

Include:

internal model ID
OpenRouter model ID
display name
provider
enabled/disabled status
pricing information where available

Do not expose unnecessary provider information during blind battles.

benchmark_generate_outputs

Generate responses from the selected competing models.

Input:

task_id
model_ids
generation parameters

The server should:

Load the benchmark task.
Send the identical task to each model.
Record latency.
Record token usage when available.
Record estimated cost.
Store raw model outputs securely.
Assign anonymous participant IDs.
Randomize output ordering.

Return only the information required to conduct the blind evaluation.

Never expose model identity alongside the anonymous output.

benchmark_start_duel

Starts an A/B battle.

Input:

task_id
output IDs

Output:

battle_id
anonymous output A
anonymous output B
evaluation criteria
voting instructions

Randomize which model becomes A or B.

The same model should not systematically appear in the same position.

benchmark_submit_vote

Records the user's preference.

Input:

battle_id
selected_output
optional tie
optional reason
optional dimension scores

Store:

user/session ID
battle ID
winning output
losing output
timestamp
optional reasoning
optional dimension scores

Do not reveal model identity before the appropriate reveal.

benchmark_get_results

Returns results for a benchmark.

Include:

number of battles
votes
win rates
ranking
confidence information
model performance by category
personal ranking
benchmark_get_leaderboard

Return rankings based on accumulated votes.

Support:

personal leaderboard
global leaderboard
category leaderboard
recent leaderboard

Use a statistically appropriate ranking system such as:

Bradley-Terry
Elo

Prefer Bradley-Terry if practical because this is fundamentally a pairwise preference problem.

Clearly distinguish rankings with low sample sizes.

benchmark_compare_models

Compare two models using accumulated benchmark data.

Return:

head-to-head record
win rate
sample size
categories
strengths
weaknesses
confidence/uncertainty
benchmark_analyze_preferences

Analyze the user's voting history.

Identify patterns such as:

preference for concise writing
preference for detailed explanations
preference for natural tone
preference for persuasive writing
preference for creativity
preference for structure
preference for technical accuracy
preference for directness

Do not manufacture conclusions when there is insufficient data.

Return:

observed preferences
supporting evidence
confidence level
models that best match those preferences

Claude can then turn this structured data into a natural-language analysis.

benchmark_get_model_stats

Return detailed statistics for a model.

Include:

battles
wins
losses
win rate
ranking score
uncertainty
category performance
average latency
estimated cost
head-to-head performance
5. Blind Evaluation Requirements

This is one of the most important parts of the system.

The benchmark MUST prevent model identity from influencing the user's vote.

During evaluation:

DO NOT show:

model name
provider
model logo
model ID
pricing
model-specific branding

Instead show:

Response A
Response B

Model identities must remain hidden until the reveal stage.

Randomize:

model pairing
A/B ordering

Do not allow deterministic ordering that could introduce positional bias.

6. Benchmark Categories

Support categories including:

General Writing
Emails
Business Writing
Creative Writing
Marketing
Summarization
Rewriting
Technical Writing
Persuasive Writing
Research Writing
Social Media
Instruction Following

Design the category system so new categories can easily be added.

7. Database

Create a clean relational schema.

At minimum include:

users
id
created_at
benchmark_tasks
id
title
category
prompt
evaluation_criteria
created_at
models
id
openrouter_model_id
display_name
provider
enabled
pricing metadata
benchmark_outputs
id
task_id
model_id
anonymous_id
output_text
token_usage
latency
estimated_cost
created_at
battles
id
task_id
output_a_id
output_b_id
created_at
votes
id
battle_id
user_id
selected_output_id
optional_reason
created_at
rankings

Store calculated ranking information or calculate it dynamically.

Design the schema so future versions can support multiple users and global rankings.

8. Ranking System

Implement pairwise ranking.

Primary ranking:

Bradley-Terry

Also consider Elo as a secondary/simple ranking representation.

The ranking system must account for sample size and uncertainty.

Do not present a model as definitively superior after only a handful of battles.

For example:

5 wins out of 6 battles should not automatically mean:

"Model X is the best model."

Instead communicate uncertainty appropriately.

9. Anti-Bias Design

The system should explicitly protect benchmark integrity.

Rules:

Same prompt for competing models.
Random A/B ordering.
Anonymous model identities.
No provider branding.
No model-specific metadata during voting.
Record all votes.
Avoid duplicate battles where possible.
Track sample sizes.
Separate personal and global rankings.
Do not manipulate pairings to produce desired results.
Never change outputs after receiving a vote.
Preserve raw benchmark data for auditing.

The system should be designed so that the benchmark itself does not intentionally favor a particular model.

10. Model Selection

OpenRouter should be the abstraction layer for model access.

Do not hardcode the benchmark around a fixed list of models.

The model registry should allow models to be:

added
removed
enabled
disabled
grouped
compared

Example models may include GPT, Claude, Gemini, Qwen, DeepSeek, Mistral, and other models available through OpenRouter.

Do not assume these specific models will always exist.

11. Cost Tracking

Track:

input tokens
output tokens
total tokens
estimated cost
generation latency

Allow benchmark reports to answer:

"How much did this benchmark cost?"

and:

"Which models provide the best writing quality relative to cost?"

12. MCP Design

The server should expose clean MCP tool descriptions so Claude understands when and how to use each tool.

Tool descriptions should clearly explain:

purpose
required parameters
output structure
privacy/blindness requirements
when the tool should be called

Use strict input validation with Zod.

Return structured JSON wherever possible.

Do not return unnecessarily huge responses.

13. Claude Desktop Experience

The intended experience should be approximately:

User:

"Benchmark the best models for writing professional emails."

Claude:

Creates the benchmark.
Selects appropriate models.
Generates anonymous responses.
Starts an A/B battle.
Shows Response A and Response B.
User chooses the better response.
Claude starts another battle.
Continue until sufficient data exists.
Calculate rankings.
Reveal which models generated the responses.
Explain the user's personal preferences.
Compare personal rankings with global rankings.

The MCP should provide the underlying capabilities.

Claude should provide the conversational orchestration.

14. Security

Implement:

environment-based secrets
API key protection
input validation
output sanitization where appropriate
safe database queries
no API keys in logs
no sensitive credentials in MCP responses

Do not expose OpenRouter credentials to Claude or the user.

15. Project Structure

Use a clean structure similar to:

src/
index.ts
server.ts

tools/
benchmarkCreateTask.ts
benchmarkListModels.ts
benchmarkGenerateOutputs.ts
benchmarkStartDuel.ts
benchmarkSubmitVote.ts
benchmarkGetResults.ts
benchmarkGetLeaderboard.ts
benchmarkCompareModels.ts
benchmarkAnalyzePreferences.ts
benchmarkGetModelStats.ts

services/
openrouter.ts
benchmark.ts
ranking.ts
voting.ts
analytics.ts
randomization.ts
costTracking.ts

db/
database.ts
schema.ts
repositories/

models/
types.ts
schemas.ts

utils/
validation.ts
logging.ts

tests/
...

README.md
.env.example
package.json
tsconfig.json

Adapt the structure if you have a better architecture, but keep responsibilities clearly separated.

16. Testing

Write tests for:

task creation
model registration
OpenRouter requests
output generation
randomization
blind identity protection
A/B battles
voting
duplicate prevention
Bradley-Terry calculations
leaderboard generation
preference analysis
cost calculation
invalid inputs
database persistence

Include integration tests where practical.

17. Deliverables

Produce a complete working project, not just pseudocode.

Deliver:

Full source code.
package.json.
TypeScript configuration.
Database implementation.
MCP server implementation.
All MCP tools.
OpenRouter integration.
Ranking engine.
Blind randomization.
Tests.
.env.example.
README.
Claude Desktop configuration example.
Setup instructions.
Example benchmark workflow.

The project should be runnable locally with:

npm install

npm run build

npm start

Provide the exact Claude Desktop MCP configuration required to connect to the local server.

18. Development Rules

Prioritize correctness over unnecessary complexity.

Do not build a web frontend for the first version.

The first version is specifically:

Claude Desktop + BlindWrite MCP + OpenRouter + SQLite

Keep the architecture extensible for a future web application.

Do not implement features that are not necessary for the MVP unless they are required for clean architecture.

When making architectural decisions, explain the decision briefly.

Start by producing:

Architecture
File tree
Database schema
MCP tool specifications
Implementation plan

Then implement the project completely.

The final result should be a usable local MCP server that can be connected to Claude Desktop and used to run blind AI writing benchmarks.