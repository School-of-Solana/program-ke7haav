import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { Program, AnchorProvider, BN, Idl } from '@coral-xyz/anchor';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import './TaskManager.css';

// Program ID - Update this after deployment to Devnet/Mainnet
// Current ID is for localnet - replace with deployed program ID
const PROGRAM_ID = new PublicKey('8N5ugPhfbeMakrLqnqoAFHnVdWwjGLWMrQZSw9Ajathk');

interface Task {
  id: BN;
  description: string;
  completed: boolean;
}

interface TaskList {
  owner: PublicKey;
  taskCount: BN;
  tasks: Task[];
}

function TaskManager() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [taskList, setTaskList] = useState<TaskList | null>(null);
  const [loading, setLoading] = useState(false);
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [initialized, setInitialized] = useState(false);

  const getTaskListPDA = (userPubkey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('task_list'), userPubkey.toBuffer()],
      PROGRAM_ID
    );
  };

  // Helper function to create program instance
  // Note: We empty the accounts array to work around Anchor's Vec<Task> size calculation bug
  const createProgram = async (provider: AnchorProvider): Promise<Program<Idl>> => {
    const idlResponse = await fetch('/task_manager.json');
  if (!idlResponse.ok) {
    throw new Error('Failed to load IDL file');
  }
  const idl = await idlResponse.json();

  // --- FIX FOR ANCHOR BUG ---
  // The JS library crashes on Vec<Task> size calculation. 
  // We empty the accounts array to disable client-side validation.
  if (idl.accounts) {
    idl.accounts = [];
  }
  // --------------------------

  return new Program(idl, PROGRAM_ID, provider);
};
  const fetchTaskList = async () => {
    if (!wallet.publicKey) return;

    try {
      const [taskListPDA] = getTaskListPDA(wallet.publicKey);
      const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
      
      // We need to fetch the account data manually since we don't have the IDL loaded
      const accountInfo = await connection.getAccountInfo(taskListPDA);
      if (accountInfo) {
        setInitialized(true);
        // In a real app, you'd deserialize using the IDL
        // For now, we'll use a simple fetch approach
        await loadTaskListData(provider, taskListPDA);
      } else {
        setInitialized(false);
        setTaskList(null);
      }
    } catch (error) {
      console.error('Error fetching task list:', error);
      setInitialized(false);
      setTaskList(null);
    }
  };

  const loadTaskListData = async (provider: AnchorProvider, taskListPDA: PublicKey) => {
    try {
      // 1. Fetch raw account info directly from connection
      // We DO NOT use program.account.taskList.fetch() because the IDL is patched
      const accountInfo = await connection.getAccountInfo(taskListPDA);
      
      if (!accountInfo) {
        setTaskList(null);
        return;
      }

      // 2. Decode the data manually
      const decodedData = decodeTaskListData(accountInfo.data);
      
      setTaskList(decodedData);
      console.log("Tasks loaded:", decodedData.tasks.length);
    } catch (error) {
      console.error('Error loading task list data:', error);
    }
  };

  useEffect(() => {
    if (wallet.publicKey) {
      fetchTaskList();
    } else {
      setTaskList(null);
      setInitialized(false);
    }
  }, [wallet.publicKey, connection]);



  const INITIALIZE_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

  const initialize = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      alert('Please connect your wallet first');
      return;
    }

    setLoading(true);
    try {
      const [taskListPDA] = getTaskListPDA(wallet.publicKey);
      
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        { commitment: 'confirmed' }
      );

      console.log('Constructing RAW transaction (Bypassing Anchor)...');

      // --- MANUAL INSTRUCTION CONSTRUCTION ---
      // This bypasses the "reading 'encode'" error entirely.
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: taskListPDA, isSigner: false, isWritable: true },       // task_list
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },   // user
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // system_program
        ],
        programId: PROGRAM_ID,
        data: INITIALIZE_DISCRIMINATOR // Only the discriminator is needed (no arguments)
      });

      const transaction = new Transaction().add(instruction);
      
      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      console.log('Sending transaction...');
      const signature = await provider.sendAndConfirm(transaction);
      
      console.log('Success! Signature:', signature);
      await fetchTaskList();
    } catch (error: any) {
      console.error('Error initializing:', error);
      // If you get an error here, check the logs!
      if (error.logs) console.log('Program Logs:', error.logs); 
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addTask = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !newTaskDescription.trim()) return;

    setLoading(true);
    try {
      const [taskListPDA] = getTaskListPDA(wallet.publicKey);
      const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });

      console.log('Adding task via Robust Raw Transaction...');

  
      const ADD_TASK_DISCRIMINATOR = new Uint8Array([234, 40, 30, 119, 150, 53, 76, 83]);

      // 2. Encode the String using TextEncoder (Browser Standard)
      const encoder = new TextEncoder();
      const descBytes = encoder.encode(newTaskDescription);
      
      // 3. Build the buffer: [Discriminator] + [4 byte len] + [String Bytes]
      const bufferSize = 8 + 4 + descBytes.length;
      const dataBuffer = new Uint8Array(bufferSize);
      const view = new DataView(dataBuffer.buffer);

      // Set Discriminator
      dataBuffer.set(ADD_TASK_DISCRIMINATOR, 0);

      // Set String Length (Little Endian) at offset 8
      view.setUint32(8, descBytes.length, true);

      // Set String Bytes at offset 12
      dataBuffer.set(descBytes, 12);

      // 4. Create Instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: taskListPDA, isSigner: false, isWritable: true },     // task_list
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // user
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(dataBuffer) // Convert Uint8Array to Buffer for web3.js
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signature = await provider.sendAndConfirm(transaction);
      console.log('Task added:', signature);

      setNewTaskDescription('');
      await fetchTaskList();
    } catch (error: any) {
      console.error('Error adding task:', error);
      if(error.logs) console.log(error.logs);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const completeTask = async (taskId: BN) => {
    if (!wallet.publicKey || !wallet.signTransaction) return;

    setLoading(true);
    try {
      const [taskListPDA] = getTaskListPDA(wallet.publicKey);
      const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });

      console.log('Completing task via Raw Transaction...');

      // 1. Discriminator for "complete_task" from IDL
      // Correct discriminator from IDL: [109, 167, 192, 41, 129, 108, 220, 196]
      const COMPLETE_TASK_DISCRIMINATOR = new Uint8Array([109, 167, 192, 41, 129, 108, 220, 196]);

      // 2. Encode task_id as u64 (8 bytes, little-endian)
      const taskIdBuffer = Buffer.allocUnsafe(8);
      // BN.toArrayLike returns big-endian, but we need little-endian
      const taskIdBigInt = BigInt(taskId.toString());
      taskIdBuffer.writeBigUInt64LE(taskIdBigInt, 0);

      // 3. Build the buffer: [Discriminator (8 bytes)] + [task_id (8 bytes)]
      const bufferSize = 8 + 8;
      const dataBuffer = new Uint8Array(bufferSize);

      // Set Discriminator
      dataBuffer.set(COMPLETE_TASK_DISCRIMINATOR, 0);

      // Set task_id at offset 8
      dataBuffer.set(taskIdBuffer, 8);

      // 4. Create Instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: taskListPDA, isSigner: false, isWritable: true },     // task_list
          { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // user
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(dataBuffer)
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signature = await provider.sendAndConfirm(transaction);
      console.log('Task completed:', signature);

      await fetchTaskList();
    } catch (error: any) {
      console.error('Error completing task:', error);
      if(error.logs) console.log(error.logs);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteTask = async (taskId: BN) => {
    if (!wallet.publicKey || !wallet.signTransaction) return;

    setLoading(true);
    try {
      const [taskListPDA] = getTaskListPDA(wallet.publicKey);
      const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });

      console.log('Deleting task via Raw Transaction...');

      // 1. Discriminator for "delete_task" from IDL
      // Correct discriminator from IDL: [112, 220, 10, 109, 3, 168, 46, 73]
      const DELETE_TASK_DISCRIMINATOR = new Uint8Array([112, 220, 10, 109, 3, 168, 46, 73]);

      // 2. Encode task_id as u64 (8 bytes, little-endian)
      const taskIdBuffer = Buffer.allocUnsafe(8);
      // BN.toArrayLike returns big-endian, but we need little-endian
      const taskIdBigInt = BigInt(taskId.toString());
      taskIdBuffer.writeBigUInt64LE(taskIdBigInt, 0);

      // 3. Build the buffer: [Discriminator (8 bytes)] + [task_id (8 bytes)]
      const bufferSize = 8 + 8;
      const dataBuffer = new Uint8Array(bufferSize);

      // Set Discriminator
      dataBuffer.set(DELETE_TASK_DISCRIMINATOR, 0);

      // Set task_id at offset 8
      dataBuffer.set(taskIdBuffer, 8);

      // 4. Create Instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: taskListPDA, isSigner: false, isWritable: true },     // task_list
          { pubkey: wallet.publicKey, isSigner: true, isWritable: false }, // user
        ],
        programId: PROGRAM_ID,
        data: Buffer.from(dataBuffer)
      });

      const transaction = new Transaction().add(instruction);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signature = await provider.sendAndConfirm(transaction);
      console.log('Task deleted:', signature);

      await fetchTaskList();
    } catch (error: any) {
      console.error('Error deleting task:', error);
      if(error.logs) console.log(error.logs);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearAllTasks = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !taskList) return;
    
    if (!confirm('Are you sure you want to delete all tasks? This cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      // Delete all tasks from the end (highest index) to avoid index shifting issues
      // The program uses task_id as the index in the array, so we delete from the end
      const taskCount = taskList.tasks.length;
      
      for (let i = taskCount - 1; i >= 0; i--) {
        // Use the current index as the task_id (the program uses it as array index)
        await deleteTask(new BN(i));
        // Refresh the task list after each deletion to get updated indices
        await fetchTaskList();
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log('All tasks cleared');
    } catch (error: any) {
      console.error('Error clearing tasks:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper to manually parse the binary data from the TaskList account
// Layout: [8 byte discriminator] [32 byte owner] [8 byte count] [4 byte vector length] [Task...]
const decodeTaskListData = (data: Buffer): TaskList => {
  let offset = 8; // Skip 8-byte discriminator

  // 1. Read Owner (32 bytes)
  const owner = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // 2. Read Task Count (8 bytes - u64)
  // simple read for u64 (assuming not huge numbers for this demo)
  const taskCount = new BN(data.readBigUInt64LE(offset).toString());
  offset += 8;

  // 3. Read Tasks Vector Length (4 bytes - u32)
  const vecLength = data.readUInt32LE(offset);
  offset += 4;

  const tasks: Task[] = [];

  for (let i = 0; i < vecLength; i++) {
    // Task Layout: [8 byte id] [4 byte string len] [string bytes] [1 byte bool]
    
    // Task ID (u64)
    const id = new BN(data.readBigUInt64LE(offset).toString());
    offset += 8;

    // Description String
    const descLen = data.readUInt32LE(offset);
    offset += 4;
    
    const description = data.slice(offset, offset + descLen).toString('utf-8');
    offset += descLen;

    // Completed (bool - 1 byte)
    const completed = data.readUInt8(offset) === 1;
    offset += 1;

    tasks.push({ id, description, completed });
  }

  return { owner, taskCount, tasks };
};

  if (!wallet.connected) {
    return (
      <div className="task-manager">
        <div className="connect-wallet">
          <h2>Connect Your Wallet</h2>
          <p>Please connect your Solana wallet to get started</p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  return (
    <div className="task-manager">
      <div className="wallet-section">
        <WalletMultiButton />
      </div>

      {!initialized ? (
        <div className="initialize-section">
          <h2>Welcome! 👋</h2>
          <p>Initialize your task list to get started</p>
          <button 
            onClick={initialize} 
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Initializing...' : 'Initialize Task List'}
          </button>
        </div>
      ) : (
        <>
          <div className="add-task-section">
            <h2>Add New Task</h2>
            <div className="input-group">
              <input
                type="text"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Enter task description..."
                maxLength={200}
                onKeyPress={(e) => e.key === 'Enter' && addTask()}
              />
              <button 
                onClick={addTask} 
                disabled={loading || !newTaskDescription.trim()}
                className="btn btn-primary"
              >
                Add Task
              </button>
            </div>
          </div>

          <div className="tasks-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Your Tasks ({taskList?.tasks.length || 0})</h2>
              {taskList && taskList.tasks.length > 0 && (
                <button
                  onClick={clearAllTasks}
                  disabled={loading}
                  className="btn btn-danger"
                  style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                >
                  Clear All Tasks
                </button>
              )}
            </div>
            {taskList && taskList.tasks.length > 0 ? (
              <div className="tasks-list">
                {taskList.tasks.map((task, index) => (
                  <div 
                    key={index} 
                    className={`task-item ${task.completed ? 'completed' : ''}`}
                  >
                    <div className="task-content">
                      <span className="task-id">#{task.id.toString()}</span>
                      <span className="task-description">{task.description}</span>
                      {task.completed && <span className="task-status">✓ Completed</span>}
                    </div>
                    <div className="task-actions">
                      {!task.completed && (
                        <button
                          onClick={() => completeTask(new BN(index))}
                          disabled={loading}
                          className="btn btn-success"
                        >
                          Complete
                        </button>
                      )}
                      <button
                        onClick={() => deleteTask(new BN(index))}
                        disabled={loading}
                        className="btn btn-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-tasks">No tasks yet. Add your first task above!</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default TaskManager;

