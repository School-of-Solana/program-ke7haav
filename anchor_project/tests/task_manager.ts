import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TaskManager } from "../target/types/task_manager";
import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";

describe("task_manager", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.taskManager as Program<TaskManager>;
  const user = provider.wallet;

  // Helper function to find PDA
  const getTaskListPDA = async (userPubkey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("task_list"), userPubkey.toBuffer()],
      program.programId
    );
  };

  describe("Initialize", () => {
    it("Successfully initializes a task list for a user", async () => {
      const [taskListPDA] = await getTaskListPDA(user.publicKey);

      const tx = await program.methods
        .initialize()
        .accounts({
          taskList: taskListPDA,
          user: user.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Initialize transaction signature", tx);

      const taskList = await program.account.taskList.fetch(taskListPDA);
      expect(taskList.owner.toString()).to.equal(user.publicKey.toString());
      expect(taskList.taskCount.toNumber()).to.equal(0);
      expect(taskList.tasks.length).to.equal(0);
    });

    it("Fails to initialize a task list that already exists", async () => {
      const [taskListPDA] = await getTaskListPDA(user.publicKey);

      try {
        await program.methods
          .initialize()
          .accounts({
            taskList: taskListPDA,
            user: user.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.toString()).to.include("already in use");
      }
    });
  });

  describe("Add Task", () => {
    it("Successfully adds a task to the task list", async () => {
      const [taskListPDA] = await getTaskListPDA(user.publicKey);
      const description = "Complete the Solana assignment";

      const tx = await program.methods
        .addTask(description)
        .accounts({
          taskList: taskListPDA,
          user: user.publicKey,
        })
        .rpc();

      console.log("Add task transaction signature", tx);

      const taskList = await program.account.taskList.fetch(taskListPDA);
      expect(taskList.taskCount.toNumber()).to.equal(1);
      expect(taskList.tasks.length).to.equal(1);
      expect(taskList.tasks[0].description).to.equal(description);
      expect(taskList.tasks[0].completed).to.be.false;
      expect(taskList.tasks[0].id.toNumber()).to.equal(0);
    });

    it("Fails to add a task with description longer than 200 characters", async () => {
      const [taskListPDA] = await getTaskListPDA(user.publicKey);
      const longDescription = "a".repeat(201);

      try {
        await program.methods
          .addTask(longDescription)
          .accounts({
            taskList: taskListPDA,
            user: user.publicKey,
          })
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.toString()).to.include("DescriptionTooLong");
      }
    });

    it("Successfully adds multiple tasks", async () => {
      const [taskListPDA] = await getTaskListPDA(user.publicKey);
      const descriptions = [
        "Task 1",
        "Task 2",
        "Task 3",
      ];

      for (const description of descriptions) {
        await program.methods
          .addTask(description)
          .accounts({
            taskList: taskListPDA,
            user: user.publicKey,
          })
          .rpc();
      }

      const taskList = await program.account.taskList.fetch(taskListPDA);
      expect(taskList.taskCount.toNumber()).to.equal(4); // 1 from previous test + 3 new ones
      expect(taskList.tasks.length).to.equal(4);
    });

    it("Fails to add a task when maximum tasks (40) is reached", async () => {
      const [taskListPDA] = await getTaskListPDA(user.publicKey);
      
      // Add tasks until we reach 40
      const currentCount = (await program.account.taskList.fetch(taskListPDA)).tasks.length;
      const tasksToAdd = 40 - currentCount;

      for (let i = 0; i < tasksToAdd; i++) {
        await program.methods
          .addTask(`Task ${i}`)
          .accounts({
            taskList: taskListPDA,
            user: user.publicKey,
          })
          .rpc();
      }

      // Try to add one more task (should fail)
      try {
        await program.methods
          .addTask("One too many")
          .accounts({
            taskList: taskListPDA,
            user: user.publicKey,
          })
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.toString()).to.include("TooManyTasks");
      }
    });
  });

  describe("Complete Task", () => {
    it("Successfully marks a task as completed", async () => {
      // Create a new user for this test
      const newUser = anchor.web3.Keypair.generate();
      const airdropSig = await provider.connection.requestAirdrop(
        newUser.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      const [taskListPDA] = await getTaskListPDA(newUser.publicKey);

      // Initialize
      await program.methods
        .initialize()
        .accounts({
          taskList: taskListPDA,
          user: newUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([newUser])
        .rpc();

      // Add a task
      await program.methods
        .addTask("Test task to complete")
        .accounts({
          taskList: taskListPDA,
          user: newUser.publicKey,
        })
        .signers([newUser])
        .rpc();

      // Complete the task
      const tx = await program.methods
        .completeTask(new anchor.BN(0))
        .accounts({
          taskList: taskListPDA,
          user: newUser.publicKey,
        })
        .signers([newUser])
        .rpc();

      console.log("Complete task transaction signature", tx);

      const taskList = await program.account.taskList.fetch(taskListPDA);
      expect(taskList.tasks[0].completed).to.be.true;
    });

    it("Fails to complete a task that doesn't exist", async () => {
      const [taskListPDA] = await getTaskListPDA(user.publicKey);

      try {
        await program.methods
          .completeTask(new anchor.BN(999))
          .accounts({
            taskList: taskListPDA,
            user: user.publicKey,
          })
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.toString()).to.include("TaskNotFound");
      }
    });

    it("Fails to complete a task that is already completed", async () => {
      const newUser = anchor.web3.Keypair.generate();
      const airdropSig = await provider.connection.requestAirdrop(
        newUser.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      const [taskListPDA] = await getTaskListPDA(newUser.publicKey);

      // Initialize
      await program.methods
        .initialize()
        .accounts({
          taskList: taskListPDA,
          user: newUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([newUser])
        .rpc();

      // Add a task
      await program.methods
        .addTask("Test task")
        .accounts({
          taskList: taskListPDA,
          user: newUser.publicKey,
        })
        .signers([newUser])
        .rpc();

      // Complete the task once
      await program.methods
        .completeTask(new anchor.BN(0))
        .accounts({
          taskList: taskListPDA,
          user: newUser.publicKey,
        })
        .signers([newUser])
        .rpc();

      // Try to complete it again (should fail)
      try {
        await program.methods
          .completeTask(new anchor.BN(0))
          .accounts({
            taskList: taskListPDA,
            user: newUser.publicKey,
          })
          .signers([newUser])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.toString()).to.include("TaskAlreadyCompleted");
      }
    });

    it("Fails when non-owner tries to complete a task", async () => {
      const owner = anchor.web3.Keypair.generate();
      const attacker = anchor.web3.Keypair.generate();
      
      const airdropOwner = await provider.connection.requestAirdrop(
        owner.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropOwner);
      
      const airdropAttacker = await provider.connection.requestAirdrop(
        attacker.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropAttacker);

      const [taskListPDA] = await getTaskListPDA(owner.publicKey);

      // Owner initializes and adds a task
      await program.methods
        .initialize()
        .accounts({
          taskList: taskListPDA,
          user: owner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([owner])
        .rpc();

      await program.methods
        .addTask("Owner's task")
        .accounts({
          taskList: taskListPDA,
          user: owner.publicKey,
        })
        .signers([owner])
        .rpc();

      // Attacker tries to complete owner's task (should fail)
      try {
        await program.methods
          .completeTask(new anchor.BN(0))
          .accounts({
            taskList: taskListPDA,
            user: attacker.publicKey,
          })
          .signers([attacker])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        // Check for either our custom error or Anchor's constraint violation
        const errorStr = err.toString();
        expect(
          errorStr.includes("Unauthorized") || 
          errorStr.includes("constraint") ||
          errorStr.includes("6004") // Error code for Unauthorized
        ).to.be.true;
      }
    });
  });

  describe("Delete Task", () => {
    it("Successfully deletes a task from the task list", async () => {
      const newUser = anchor.web3.Keypair.generate();
      const airdropSig = await provider.connection.requestAirdrop(
        newUser.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      const [taskListPDA] = await getTaskListPDA(newUser.publicKey);

      // Initialize
      await program.methods
        .initialize()
        .accounts({
          taskList: taskListPDA,
          user: newUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([newUser])
        .rpc();

      // Add two tasks
      await program.methods
        .addTask("Task to delete")
        .accounts({
          taskList: taskListPDA,
          user: newUser.publicKey,
        })
        .signers([newUser])
        .rpc();

      await program.methods
        .addTask("Task to keep")
        .accounts({
          taskList: taskListPDA,
          user: newUser.publicKey,
        })
        .signers([newUser])
        .rpc();

      // Delete the first task
      const tx = await program.methods
        .deleteTask(new anchor.BN(0))
        .accounts({
          taskList: taskListPDA,
          user: newUser.publicKey,
        })
        .signers([newUser])
        .rpc();

      console.log("Delete task transaction signature", tx);

      const taskList = await program.account.taskList.fetch(taskListPDA);
      expect(taskList.tasks.length).to.equal(1);
      expect(taskList.tasks[0].description).to.equal("Task to keep");
    });

    it("Fails to delete a task that doesn't exist", async () => {
      const [taskListPDA] = await getTaskListPDA(user.publicKey);

      try {
        await program.methods
          .deleteTask(new anchor.BN(999))
          .accounts({
            taskList: taskListPDA,
            user: user.publicKey,
          })
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err.toString()).to.include("TaskNotFound");
      }
    });

    it("Fails when non-owner tries to delete a task", async () => {
      const owner = anchor.web3.Keypair.generate();
      const attacker = anchor.web3.Keypair.generate();
      
      const airdropOwner = await provider.connection.requestAirdrop(
        owner.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropOwner);
      
      const airdropAttacker = await provider.connection.requestAirdrop(
        attacker.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropAttacker);

      const [taskListPDA] = await getTaskListPDA(owner.publicKey);

      // Owner initializes and adds a task
      await program.methods
        .initialize()
        .accounts({
          taskList: taskListPDA,
          user: owner.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([owner])
        .rpc();

      await program.methods
        .addTask("Owner's task")
        .accounts({
          taskList: taskListPDA,
          user: owner.publicKey,
        })
        .signers([owner])
        .rpc();

      // Attacker tries to delete owner's task (should fail)
      try {
        await program.methods
          .deleteTask(new anchor.BN(0))
          .accounts({
            taskList: taskListPDA,
            user: attacker.publicKey,
          })
          .signers([attacker])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        // Check for either our custom error or Anchor's constraint violation
        const errorStr = err.toString();
        expect(
          errorStr.includes("Unauthorized") || 
          errorStr.includes("constraint") ||
          errorStr.includes("6004") // Error code for Unauthorized
        ).to.be.true;
      }
    });
  });
});
