# Task Manager - Solana Program

A Solana program built with Anchor for managing personal task lists on-chain.

## Features

- Initialize a personal task list account (PDA-based)
- Add tasks with descriptions (max 200 characters)
- Mark tasks as completed
- Delete tasks
- Support for up to 40 tasks per user

## Program Instructions

1. **initialize**: Creates a new TaskList account for the user
2. **add_task**: Adds a new task to the user's task list
3. **complete_task**: Marks a task as completed
4. **delete_task**: Removes a task from the list

## Building

```bash
anchor build
```

## Testing

```bash
anchor test
```

The test suite includes:
- Happy path tests for all instructions
- Error handling tests (unauthorized access, invalid inputs, etc.)
- Edge cases (max tasks, duplicate initialization, etc.)

## Deployment

### To Devnet

1. Update `Anchor.toml` to use devnet:
```toml
[provider]
cluster = "devnet"
```

2. Build and deploy:
```bash
anchor build
anchor deploy
```

3. Update the program ID in:
   - `PROJECT_DESCRIPTION.md`
   - `frontend/src/components/TaskManager.tsx`

### To Mainnet

1. Update `Anchor.toml`:
```toml
[provider]
cluster = "mainnet"
```

2. Build and deploy:
```bash
anchor build
anchor deploy --provider.cluster mainnet
```

## Program ID

Current program ID (localnet): `8N5ugPhfbeMakrLqnqoAFHnVdWwjGLWMrQZSw9Ajathk`

Update this after deployment to Devnet/Mainnet.

## Account Structure

- **TaskList**: Stores user's tasks in a PDA
  - Owner: Pubkey
  - Task count: u64
  - Tasks: Vec<Task> (max 40)

- **Task**: Individual task item
  - ID: u64
  - Description: String (max 200 chars)
  - Completed: bool
