use anchor_lang::prelude::*;

declare_id!("8N5ugPhfbeMakrLqnqoAFHnVdWwjGLWMrQZSw9Ajathk");

#[program]
pub mod task_manager {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let task_list = &mut ctx.accounts.task_list;
        task_list.owner = ctx.accounts.user.key();
        task_list.task_count = 0;
        task_list.tasks = Vec::new();
        msg!("Task list initialized for user: {}", task_list.owner);
        Ok(())
    }

    pub fn add_task(ctx: Context<AddTask>, description: String) -> Result<()> {
        require!(
            description.len() <= 200,
            TaskManagerError::DescriptionTooLong
        );
        require!(
            ctx.accounts.task_list.tasks.len() < 40,
            TaskManagerError::TooManyTasks
        );

        let task_list = &mut ctx.accounts.task_list;
        let task_id = task_list.task_count;

        task_list.tasks.push(Task {
            id: task_id,
            description,
            completed: false,
        });

        task_list.task_count += 1;
        msg!("Task added with ID: {}", task_id);
        Ok(())
    }

    pub fn complete_task(ctx: Context<CompleteTask>, task_id: u64) -> Result<()> {
        let task_list = &mut ctx.accounts.task_list;
        
        require!(
            (task_id as usize) < task_list.tasks.len(),
            TaskManagerError::TaskNotFound
        );

        let task = &mut task_list.tasks[task_id as usize];
        require!(!task.completed, TaskManagerError::TaskAlreadyCompleted);
        
        task.completed = true;
        msg!("Task {} marked as completed", task_id);
        Ok(())
    }

    pub fn delete_task(ctx: Context<DeleteTask>, task_id: u64) -> Result<()> {
        let task_list = &mut ctx.accounts.task_list;
        
        require!(
            (task_id as usize) < task_list.tasks.len(),
            TaskManagerError::TaskNotFound
        );

        task_list.tasks.remove(task_id as usize);
        msg!("Task {} deleted", task_id);
        Ok(())
    }
}

#[account]
pub struct TaskList {
    pub owner: Pubkey,
    pub task_count: u64,
    pub tasks: Vec<Task>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Task {
    pub id: u64,
    pub description: String,
    pub completed: bool,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 8 + 4 + (40 * (8 + 4 + 200 + 1)), // Account discriminator + owner + task_count + vec length + (max 40 tasks * (id + description len + description + completed))
        seeds = [b"task_list", user.key().as_ref()],
        bump
    )]
    pub task_list: Account<'info, TaskList>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddTask<'info> {
    #[account(
        mut,
        seeds = [b"task_list", user.key().as_ref()],
        bump,
        constraint = task_list.owner == user.key() @ TaskManagerError::Unauthorized
    )]
    pub task_list: Account<'info, TaskList>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct CompleteTask<'info> {
    #[account(
        mut,
        seeds = [b"task_list", user.key().as_ref()],
        bump,
        constraint = task_list.owner == user.key() @ TaskManagerError::Unauthorized
    )]
    pub task_list: Account<'info, TaskList>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeleteTask<'info> {
    #[account(
        mut,
        seeds = [b"task_list", user.key().as_ref()],
        bump,
        constraint = task_list.owner == user.key() @ TaskManagerError::Unauthorized
    )]
    pub task_list: Account<'info, TaskList>,
    pub user: Signer<'info>,
}

#[error_code]
pub enum TaskManagerError {
    #[msg("Description is too long. Maximum 200 characters.")]
    DescriptionTooLong,
    #[msg("Maximum number of tasks (40) reached.")]
    TooManyTasks,
    #[msg("Task not found.")]
    TaskNotFound,
    #[msg("Task is already completed.")]
    TaskAlreadyCompleted,
    #[msg("Unauthorized: Only the owner can perform this action.")]
    Unauthorized,
}
