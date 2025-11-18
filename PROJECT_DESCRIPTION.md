# Project Description

**Deployed Frontend URL:** [TODO: Link to your deployed frontend - Deploy to Vercel/Netlify after completing setup]

**Solana Program ID:** `8N5ugPhfbeMakrLqnqoAFHnVdWwjGLWMrQZSw9Ajathk`

## Project Overview

### Description

Task Manager is a decentralized task management application built on Solana. Users can create, manage, and track their personal tasks on-chain. Each user has their own isolated task list stored in a Program Derived Address (PDA), ensuring data privacy and ownership. The dApp demonstrates core Solana development concepts including PDAs, account management, state persistence, and transaction handling.

The application allows users to:
- Initialize a personal task list account
- Add tasks with descriptions (up to 200 characters)
- Mark tasks as completed
- Delete tasks from their list
- View all their tasks in a clean, intuitive interface

### Key Features

- **Personal Task Lists**: Each user gets their own on-chain task list stored in a PDA
- **Task Management**: Create, complete, and delete tasks with simple transactions (up to 40 tasks per user)
- **Wallet Integration**: Seamless integration with Phantom and Solflare wallets
- **Real-time Updates**: View your tasks immediately after on-chain updates
- **User Isolation**: Each user's tasks are completely isolated using PDA-based addressing
- **Error Handling**: Comprehensive validation for task descriptions, limits, and permissions

### How to Use the dApp

1. **Connect Wallet**
   - Click the "Select Wallet" button in the top right
   - Choose Phantom, Solflare, or another supported Solana wallet
   - Approve the connection request

2. **Initialize Your Task List**
   - After connecting, click "Initialize Task List" to create your on-chain task account
   - This creates a PDA that will store all your tasks
   - You only need to do this once per wallet

3. **Add Tasks**
   - Type a task description in the input field (max 200 characters)
   - Click "Add Task" or press Enter
   - The task will be added to your list and stored on-chain

4. **Complete Tasks**
   - Click the "Complete" button next to any incomplete task
   - The task will be marked as completed (you can see a checkmark)
   - Completed tasks are visually distinguished with a green border

5. **Delete Tasks**
   - Click the "Delete" button next to any task to remove it permanently
   - The task will be removed from both the UI and the on-chain account

## Program Architecture

The Task Manager program uses a simple but effective architecture with one main account type (`TaskList`) and four core instructions. The program leverages PDAs to create deterministic, user-specific accounts, ensuring each user has their own isolated task storage.

### PDA Usage

The program uses Program Derived Addresses to create deterministic task list accounts for each user. This approach ensures:
- Each user has exactly one task list account
- Accounts are deterministically derived from the user's public key
- No need for users to manage account addresses manually
- Efficient account lookup and validation

**PDAs Used:**
- **TaskList PDA**: Derived from seeds `["task_list", user_wallet_pubkey]` - Creates a unique, deterministic account for each user's task list. The PDA ensures that each user can only have one task list and that only the owner can modify their tasks.

### Program Instructions

**Instructions Implemented:**

1. **`initialize`**: Creates a new `TaskList` account for the user. This account is stored in a PDA derived from the user's public key. Initializes with an empty task array and sets the owner to the user's wallet address. This must be called once before a user can add tasks.

2. **`add_task`**: Adds a new task to the user's task list. Validates that the description is not longer than 200 characters and that the user hasn't exceeded the maximum of 40 tasks. Each task is assigned a unique ID based on the current task count.

3. **`complete_task`**: Marks a specific task as completed by setting its `completed` field to `true`. Validates that the task exists and hasn't already been completed. Only the owner of the task list can complete tasks.

4. **`delete_task`**: Removes a task from the user's task list. The task is permanently deleted from the on-chain account. Validates that the task exists before deletion. Only the owner can delete tasks.

### Account Structure

```rust
#[account]
pub struct TaskList {
    pub owner: Pubkey,        // The wallet address that owns this task list
    pub task_count: u64,      // Total number of tasks created (for ID generation)
    pub tasks: Vec<Task>,     // Vector of tasks (max 40 tasks)
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Task {
    pub id: u64,              // Unique task identifier
    pub description: String,   // Task description (max 200 characters)
    pub completed: bool,       // Completion status
}
```

The `TaskList` account stores all tasks for a user in a single account. The account size is calculated to accommodate up to 40 tasks, with each task having a maximum description length of 200 characters. The `task_count` field tracks the total number of tasks created, which is used to assign unique IDs to new tasks.

## Testing

### Test Coverage

Comprehensive test suite covering all four instructions with both successful operations and error conditions. The tests ensure program security, data integrity, and proper access control.

**Happy Path Tests:**
- **Initialize Task List**: Successfully creates a new task list account with correct initial values (owner set, task_count = 0, empty tasks array)
- **Add Task**: Properly adds a task to the list, increments task_count, and assigns correct task ID
- **Add Multiple Tasks**: Successfully adds multiple tasks and maintains correct ordering and IDs
- **Complete Task**: Marks a task as completed while preserving other task data
- **Delete Task**: Removes a task from the list and updates the task array correctly

**Unhappy Path Tests:**
- **Initialize Duplicate**: Fails when trying to initialize a task list that already exists (account already in use error)
- **Add Task - Description Too Long**: Fails when task description exceeds 200 characters (DescriptionTooLong error)
- **Add Task - Too Many Tasks**: Fails when trying to add more than 40 tasks (TooManyTasks error)
- **Complete Task - Not Found**: Fails when trying to complete a task with an invalid ID (TaskNotFound error)
- **Complete Task - Already Completed**: Fails when trying to complete a task that's already marked as completed (TaskAlreadyCompleted error)
- **Complete Task - Unauthorized**: Fails when a non-owner tries to complete someone else's task (Unauthorized error)
- **Delete Task - Not Found**: Fails when trying to delete a task with an invalid ID (TaskNotFound error)
- **Delete Task - Unauthorized**: Fails when a non-owner tries to delete someone else's task (Unauthorized error)

### Running Tests

```bash
cd anchor_project
anchor test
```

The tests use Anchor's testing framework with a local validator. All tests create separate keypairs to test isolation and authorization properly.

### Additional Notes for Evaluators

**Implementation Details:**
- The program uses PDAs for all task list accounts, ensuring deterministic addressing
- Account size is pre-calculated to accommodate up to 40 tasks with 200-character descriptions (fits within Solana's 10KB reallocation limit)
- All instructions include proper ownership validation using Anchor constraints
- Error codes are custom-defined for better error handling and user feedback

**Frontend:**
- Built with React + TypeScript using Vite
- Uses Solana Wallet Adapter for wallet connectivity
- Fetches IDL from public directory for program interaction
- Responsive design with modern UI/UX

**Deployment Notes:**
- Program ID in the code is the default localnet ID - will need to be updated after deployment
- Frontend is configured for Devnet by default (can be changed in App.tsx)
- IDL file is copied to frontend/public directory for runtime access
- Both program and frontend are ready for deployment to Devnet/Mainnet

**Potential Improvements:**
- Could add task editing functionality
- Could implement task priorities or categories
- Could add due dates or reminders
- Could implement task sharing between users
- Could add pagination for users with many tasks
