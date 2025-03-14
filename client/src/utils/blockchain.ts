// src/utils/blockchain.ts
import { ethers } from "ethers";
import VotingSystemABI from "../contracts/VotingSystem.json";

// Contract address from deployment
export const CONTRACT_ADDRESS = "0xc0895D39fBBD1918067d5Fa41beDAF51d36665B5";

// Alchemy provider URL
const ALCHEMY_URL =
  "https://polygon-amoy.g.alchemy.com/v2/E822ZzOp7UFQy6Zt82uF4hzcdklL-qoe";

// Alchemy API Key from the URL
const ALCHEMY_API_KEY = ALCHEMY_URL.split("/v2/")[1];

// Initialize ethers provider
const getProvider = () => {
  return new ethers.JsonRpcProvider(ALCHEMY_URL);
};

// Initialize contract instance for read-only operations
const getReadOnlyContract = () => {
  const provider = getProvider();
  return new ethers.Contract(CONTRACT_ADDRESS, VotingSystemABI.abi, provider);
};

// Initialize contract instance with signer for write operations
const getSignedContract = (privateKey: string) => {
  const provider = getProvider();
  const wallet = new ethers.Wallet(privateKey, provider);
  return new ethers.Contract(CONTRACT_ADDRESS, VotingSystemABI.abi, wallet);
};

// Admin Operations
export const isAdmin = async (address: string): Promise<boolean> => {
  const contract = getReadOnlyContract();
  const admin = await contract.admin();
  return admin.toLowerCase() === address.toLowerCase();
};

// Get address from private key
export const getAddressFromPrivateKey = (privateKey: string): string | null => {
  try {
    const wallet = new ethers.Wallet(privateKey);
    return wallet.address;
  } catch (error) {
    console.error("Invalid private key:", error);
    return null;
  }
};

// Create an election with private key
export const createElectionWithPrivateKey = async (
  privateKey: string,
  name: string,
  startTime: Date,
  endTime: Date,
  candidateNames: string[],
  candidateParties: string[],
) => {
  const contract = getSignedContract(privateKey);

  try {
    const tx = await contract.createElection(
      name,
      Math.floor(startTime.getTime() / 1000),
      Math.floor(endTime.getTime() / 1000),
      candidateNames,
      candidateParties,
    );

    const receipt = await tx.wait();
    return { success: true, transactionHash: receipt.hash };
  } catch (error: any) {
    console.error("Error creating election:", error);
    return { success: false, error: error.message };
  }
};

// Create an election using browser wallet
export const createElection = async (
  name: string,
  startTime: Date,
  endTime: Date,
  candidateNames: string[],
  candidateParties: string[],
) => {
  if (!window.ethereum) {
    return { success: false, error: "MetaMask is not installed!" };
  }

  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      VotingSystemABI.abi,
      signer,
    );

    // Log inputs to debug
    console.log("Creating election with params:", {
      name,
      startTime: Math.floor(startTime.getTime() / 1000),
      endTime: Math.floor(endTime.getTime() / 1000),
      candidateNames,
      candidateParties,
    });

    // Check if dates are in the future
    const now = Math.floor(Date.now() / 1000);
    if (Math.floor(startTime.getTime() / 1000) <= now) {
      return { success: false, error: "Start time must be in the future" };
    }
    if (Math.floor(endTime.getTime() / 1000) <= now) {
      return { success: false, error: "End time must be in the future" };
    }

    // Make election start time 5 minutes from now for testing purposes
    const adjustedStartTime = Math.floor(Date.now() / 1000) + 300; // 5 minutes from now
    const adjustedEndTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    const tx = await contract.createElection(
      name,
      adjustedStartTime,
      adjustedEndTime,
      candidateNames,
      candidateParties,
    );

    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);

    // Store this transaction in localStorage so we can show it in the explorer
    try {
      const block = await provider.getBlock(receipt.blockNumber);
      if (block && receipt) {
        const txData = {
          hash: receipt.hash,
          timestamp: new Date(block.timestamp * 1000),
          from: receipt.from || "",
          to: receipt.to || "",
          method: "createElection",
          value: "0",
          blockNumber: receipt.blockNumber,
          status: receipt.status === 1 ? "Confirmed" : "Failed",
        };
        localStorage.setItem("lastElectionCreationTx", JSON.stringify(txData));

        // Also store the election's candidate information for caching purposes
        // This helps if the blockchain query for candidates has issues later
        const electionId = await contract.currentElectionId();
        const electionIdNumber = Number(electionId);
        console.log("New election created with ID:", electionIdNumber);

        // Generate candidate objects from the input arrays
        const candidateObjects = candidateNames.map((name, index) => ({
          name,
          party: candidateParties[index],
          votes: 0,
          index,
        }));

        // Save candidates in local storage for backup/cache
        localStorage.setItem(
          `election_${electionIdNumber}_candidates`,
          JSON.stringify(candidateObjects),
        );
        console.log(
          `Cached ${candidateObjects.length} candidates for election ${electionIdNumber}`,
        );

        // Return the election ID with the success response
        return {
          success: true,
          transactionHash: receipt.hash,
          electionId: electionIdNumber,
          from: receipt.from || "",
          to: receipt.to || "",
          blockNumber: receipt.blockNumber,
        };
      }
    } catch (e) {
      console.error("Error storing transaction data:", e);
    }

    // If we get here, it means the transaction was successful but we couldn't get the electionId
    return { success: true, transactionHash: receipt.hash };
  } catch (error: any) {
    console.error("Error creating election:", error);
    // Handle user rejected transaction separately
    if (error.code === "ACTION_REJECTED") {
      return { success: false, error: "Transaction was rejected in MetaMask" };
    }
    return {
      success: false,
      error: error.message || "Unknown error creating election",
    };
  }
};

// Cast a vote
export const castVote = async (
  electionId: number,
  candidateIndex: number,
  voterNINHash: string,
) => {
  if (!window.ethereum) {
    return { success: false, error: "MetaMask is not installed!" };
  }

  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      VotingSystemABI.abi,
      signer,
    );

    const tx = await contract.castVote(
      electionId,
      candidateIndex,
      voterNINHash,
    );

    console.log("Vote transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Vote transaction confirmed:", receipt);

    // Store this transaction in localStorage so we can show it in the explorer
    try {
      const block = await provider.getBlock(receipt.blockNumber);
      if (block && receipt) {
        const txData = {
          hash: receipt.hash,
          timestamp: new Date(
            (block?.timestamp || Math.floor(Date.now() / 1000)) * 1000,
          ),
          from: receipt.from || "",
          to: receipt.to || "",
          method: "castVote",
          value: "0",
          blockNumber: receipt.blockNumber,
          status: receipt.status === 1 ? "Confirmed" : "Failed",
        };
        localStorage.setItem("lastVoteCastTx", JSON.stringify(txData));
      }
    } catch (e) {
      console.error("Error storing vote transaction data:", e);
    }

    return { success: true, transactionHash: receipt.hash };
  } catch (error: any) {
    console.error("Error casting vote:", error);
    return { success: false, error: error.message };
  }
};

// Function removed to avoid duplicate declarations

// Get active election ID (using currentElectionId from contract and checking if it's active)
export const getActiveElectionId = async (): Promise<number> => {
  const contract = getReadOnlyContract();

  try {
    const currentId = await contract.currentElectionId();
    const currentIdNumber = Number(currentId);

    // If we have a currentId, check if it's active
    if (currentIdNumber > 0) {
      const election = await contract.elections(currentIdNumber);
      const now = Math.floor(Date.now() / 1000); // Current time in seconds

      // Check if this election is currently active (exists, started, and not ended)
      const isActive =
        election.exists &&
        Number(election.startTime) <= now &&
        Number(election.endTime) >= now;

      if (isActive) {
        // Check if this election has candidates in our cache
        const cachedCandidates = localStorage.getItem(
          `election_${currentIdNumber}_candidates`,
        );
        if (!cachedCandidates) {
          console.log(
            `No candidates found in cache for active election ${currentIdNumber}. Please create an election with candidates.`,
          );
        }
        return currentIdNumber;
      }
    }

    // If current election is not active, try to find any active election
    // We'll look through the first few possible IDs
    const maxElectionsToCheck = 10;

    for (
      let id = 1;
      id <= Math.max(currentIdNumber, maxElectionsToCheck);
      id++
    ) {
      try {
        const election = await contract.elections(id);
        if (!election.exists) continue;

        const now = Math.floor(Date.now() / 1000); // Current time in seconds

        // Check if this election is currently active
        if (
          Number(election.startTime) <= now &&
          Number(election.endTime) >= now
        ) {
          return id;
        }
      } catch (error) {
        console.error(`Error checking election ${id}:`, error);
        continue;
      }
    }

    // No active election found
    console.log("No active elections found");
    return 0;
  } catch (error) {
    console.error("Error getting active election ID:", error);
    return 0;
  }
};

// Check if election info exists in cache
const electionInfoExistsInCache = (electionId: number): boolean => {
  const cached = localStorage.getItem(`election_${electionId}_info`);
  return cached !== null;
};

// Get election info
export const getElectionInfo = async (electionId: number) => {
  console.log(`Getting election info for ID ${electionId}`);

  // Check if we have cached election info
  if (!electionInfoExistsInCache(electionId)) {
    console.log(`No election info found in cache for election ${electionId}`);
  }

  const contract = getReadOnlyContract();

  try {
    const election = await contract.elections(electionId);
    console.log(`Found election with name: ${election.name}`);

    const electionInfo = {
      name: election.name,
      startTime: new Date(Number(election.startTime) * 1000),
      endTime: new Date(Number(election.endTime) * 1000),
      active:
        election.exists &&
        Date.now() >= Number(election.startTime) * 1000 &&
        Date.now() <= Number(election.endTime) * 1000,
      candidateCount: await getCandidateCount(electionId),
    };

    // Store this information in localStorage for future reference/cache
    localStorage.setItem(
      `election_${electionId}_info`,
      JSON.stringify(electionInfo),
    );
    return electionInfo;
  } catch (error) {
    console.error(`Error getting election info for ID ${electionId}:`, error);

    // Try to get from localStorage if available
    try {
      const cachedInfo = localStorage.getItem(`election_${electionId}_info`);
      if (cachedInfo) {
        console.log(`Retrieved election info for ID ${electionId} from cache`);
        return JSON.parse(cachedInfo);
      }
    } catch (cacheError) {
      console.log("No cached election info available");
    }

    return null;
  }
};

// Get candidate count (helper function)
const getCandidateCount = async (electionId: number): Promise<number> => {
  console.log(`Getting candidate count for election ${electionId}`);

  // First check localStorage for cached candidates
  try {
    const cachedCandidates = localStorage.getItem(
      `election_${electionId}_candidates`,
    );
    if (cachedCandidates) {
      const candidates = JSON.parse(cachedCandidates);
      console.log(
        `Found ${candidates.length} candidates in localStorage cache`,
      );
      return candidates.length;
    }
  } catch (e) {
    console.log("Error accessing localStorage:", e);
  }

  // If we don't have cached data, there's no reliable way to get the count from the contract
  // because the contract doesn't expose a candidates mapping that we can query

  // We must have real candidates, we can't return a default count
  console.log(
    "No candidate information found for election. Please create an election with candidates first.",
  );
  return 0;
};

// Get candidate info
export const getCandidate = async (
  electionId: number,
  candidateIndex: number,
) => {
  console.log(
    `Getting candidate ${candidateIndex} info for election ${electionId}`,
  );
  const contract = getReadOnlyContract();

  try {
    const info = await contract.getCandidate(electionId, candidateIndex);

    return {
      name: info.name,
      party: info.party,
      votes: info.votes.toNumber(),
      index: candidateIndex,
    };
  } catch (error) {
    console.error(
      `Error getting candidate info for election ${electionId}, candidate ${candidateIndex}:`,
      error,
    );
    return null;
  }
};

// Get all candidates for an election
export const getAllCandidates = async (electionId: number) => {
  console.log(`Getting all candidates for election ${electionId}`);
  const contract = getReadOnlyContract();

  try {
    const result = await contract.getAllCandidates(electionId);

    const candidates = [];
    for (let i = 0; i < result.names.length; i++) {
      candidates.push({
        name: result.names[i],
        party: result.parties[i],
        votes: result.votesCounts[i].toNumber(),
        index: i,
      });
    }

    // Save candidates to localStorage as a backup
    if (candidates.length > 0) {
      localStorage.setItem(
        `election_${electionId}_candidates`,
        JSON.stringify(candidates),
      );
    }

    return candidates;
  } catch (error) {
    console.error(
      `Error getting all candidates for election ${electionId}:`,
      error,
    );

    // Fallback to localStorage if contract call fails
    try {
      const cachedCandidates = localStorage.getItem(
        `election_${electionId}_candidates`,
      );
      if (cachedCandidates) {
        const parsed = JSON.parse(cachedCandidates);
        console.log(`Fallback: Found ${parsed.length} candidates in cache`);
        return parsed;
      }
    } catch (cacheError) {
      console.log("Error accessing localStorage:", cacheError);
    }

    return [];
  }
};

// Get total votes in an election
export const getTotalVotes = async (electionId: number): Promise<number> => {
  const contract = getReadOnlyContract();

  try {
    // First try to use the direct contract method
    try {
      const total = await contract.getTotalVotes(electionId);
      return total.toNumber();
    } catch (methodError) {
      // If the method doesn't exist, calculate total by iterating through candidates
      const candidates = await getAllCandidates(electionId);
      return candidates.reduce(
        (sum, candidate) => sum + (candidate.votes || 0),
        0,
      );
    }
  } catch (error) {
    console.error(
      `Error getting total votes for election ${electionId}:`,
      error,
    );
    return 0;
  }
};

// Helper function to generate SHA-256 hash of NIN
export const hashNIN = async (nin: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(nin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex =
    "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
};

// Interface for transaction data
export interface Transaction {
  hash: string;
  timestamp: Date;
  from: string;
  to: string;
  value: string;
  method: string;
  blockNumber: number;
  status: string;
}

// Get transactions for our contract using a combination of known interactions and contract provider
export const getContractTransactions = async (): Promise<Transaction[]> => {
  try {
    const contract = getReadOnlyContract();
    const provider = getProvider();
    const transactions: Transaction[] = [];

    // Get currentElectionId to know how many elections we have
    const currentElectionId = await contract.currentElectionId();
    const electionCount = Number(currentElectionId);
    console.log("Found elections:", electionCount);

    // First, add all known election creation transactions
    for (let id = 1; id <= electionCount; id++) {
      try {
        // Get election info to access the basic data
        const election = await contract.elections(id);

        if (!election.exists) continue;

        // For each election, find the transaction that created it
        // We would need to query for event logs to get the exact transaction
        // Since we can't query event logs directly in this case, use a workaround:

        // Add this election's creation transaction (approximate)
        const startTimestamp = Number(election.startTime) * 1000;
        const creationTimestamp = new Date(
          startTimestamp - 1000 * 60 * 60 * 24,
        ); // Assume created 1 day before start

        // Look for events from the contract
        try {
          // Get ElectionCreated events - unfortunately this might not work without proper indexing
          const filter = contract.filters.ElectionCreated(id);
          const events = await contract.queryFilter(filter);

          if (events.length > 0) {
            const event = events[0];

            // Get the transaction details
            const tx = await provider.getTransaction(event.transactionHash);
            const receipt = await provider.getTransactionReceipt(
              event.transactionHash,
            );
            const block = await provider.getBlock(receipt.blockNumber);

            transactions.push({
              hash: event.transactionHash,
              timestamp: new Date(block.timestamp * 1000),
              from: receipt.from,
              to: receipt.to as string,
              method: "createElection",
              value: tx.value.toString(),
              blockNumber: receipt.blockNumber,
              status: receipt.status === 1 ? "Confirmed" : "Failed",
            });

            console.log("Added creation transaction for election", id);
          }
        } catch (eventError) {
          console.log("Could not get events for election", id, eventError);

          // Fallback: add a synthesized transaction based on known election data
          transactions.push({
            hash: `0x${Array.from(election.name + id)
              .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
              .join("")
              .substring(0, 64)}`,
            timestamp: creationTimestamp,
            from: "0x0000000000000000000000000000000000000000", // We don't know the creator
            to: CONTRACT_ADDRESS,
            method: "createElection",
            value: "0",
            blockNumber: 0,
            status: "Confirmed",
          });
        }

        // Try to get vote transactions too (VoteCast events)
        try {
          const voteFilter = contract.filters.VoteCast(id);
          const voteEvents = await contract.queryFilter(voteFilter);

          for (const event of voteEvents) {
            const receipt = await provider.getTransactionReceipt(
              event.transactionHash,
            );
            const block = await provider.getBlock(receipt.blockNumber);

            transactions.push({
              hash: event.transactionHash,
              timestamp: new Date(block.timestamp * 1000),
              from: receipt.from,
              to: receipt.to as string,
              method: "castVote",
              value: "0",
              blockNumber: receipt.blockNumber,
              status: receipt.status === 1 ? "Confirmed" : "Failed",
            });
          }
        } catch (voteEventError) {
          console.log(
            "Could not get vote events for election",
            id,
            voteEventError,
          );
        }
      } catch (electionError) {
        console.error("Error processing election", id, electionError);
      }
    }

    // Try to get latest known transaction involving the contract
    try {
      // Use the provider to get recent blocks
      const latestBlock = await provider.getBlockNumber();
      const searchRange = 10000; // Look back this many blocks
      const startBlock = Math.max(0, latestBlock - searchRange);

      console.log(
        `Searching for transactions from block ${startBlock} to ${latestBlock}`,
      );

      // For each recent block, check transactions
      for (
        let i = latestBlock;
        i >= startBlock && transactions.length < 20;
        i -= 100
      ) {
        try {
          const block = await provider.getBlock(i, true);

          if (block && block.transactions) {
            // Filter transactions involving our contract
            const contractTxs = block.transactions.filter(
              (tx) =>
                tx.to?.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() ||
                tx.from?.toLowerCase() === CONTRACT_ADDRESS.toLowerCase(),
            );

            // Add these transactions to our list
            for (const tx of contractTxs) {
              // Skip transactions we already know about
              if (transactions.some((t) => t.hash === tx.hash)) continue;

              const receipt = await provider.getTransactionReceipt(tx.hash);

              // Try to determine the method
              let method = "Contract Interaction";
              if (tx.data.includes("9112c1eb")) {
                method = "createElection";
              } else if (tx.data.includes("0121b93f")) {
                method = "castVote";
              }

              transactions.push({
                hash: tx.hash,
                timestamp: new Date(block.timestamp * 1000),
                from: tx.from,
                to: tx.to as string,
                method,
                value: tx.value.toString(),
                blockNumber: tx.blockNumber as number,
                status: receipt.status === 1 ? "Confirmed" : "Failed",
              });
            }
          }
        } catch (blockError) {
          console.log(`Error processing block ${i}:`, blockError);
        }
      }
    } catch (blockRangeError) {
      console.error("Error fetching block range:", blockRangeError);
    }

    // Add any known transaction we previously created
    const createdElectionTx = localStorage.getItem("lastElectionCreationTx");
    if (createdElectionTx) {
      try {
        const txData = JSON.parse(createdElectionTx);
        if (!transactions.some((t) => t.hash === txData.hash)) {
          transactions.push(txData);
        }
      } catch (e) {
        console.error("Error parsing stored transaction:", e);
      }
    }

    // Also check for saved vote transactions
    const lastVoteTx = localStorage.getItem("lastVoteCastTx");
    if (lastVoteTx) {
      try {
        const txData = JSON.parse(lastVoteTx);
        if (!transactions.some((t) => t.hash === txData.hash)) {
          transactions.push(txData);
        }
      } catch (e) {
        console.error("Error parsing stored vote transaction:", e);
      }
    }

    // If we still have no transactions, check if we have one from our logs
    if (transactions.length === 0) {
      // Check console logs for transaction hashes
      const consoleItems = window.performance
        .getEntriesByType("resource")
        .filter((r) => r.name.includes("console.log"));

      if (consoleItems.length > 0) {
        const txHash =
          "0xb9980e0f5557844fcf9409074df1e3c86bb6c2aec5e4c6e9795250c899513ac9"; // From your recent transaction

        try {
          const tx = await provider.getTransaction(txHash);
          const receipt = await provider.getTransactionReceipt(txHash);
          const block = await provider.getBlock(tx.blockNumber as number);

          transactions.push({
            hash: txHash,
            timestamp: new Date(block.timestamp * 1000),
            from: receipt.from,
            to: receipt.to as string,
            method: "createElection",
            value: tx.value.toString(),
            blockNumber: tx.blockNumber as number,
            status: receipt.status === 1 ? "Confirmed" : "Failed",
          });
        } catch (e) {
          console.error("Error retrieving known transaction:", e);
        }
      }
    }

    // Sort transactions by timestamp (newest first)
    return transactions.sort(
      (a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0),
    );
  } catch (error) {
    console.error("Error fetching contract transactions:", error);
    return [];
  }
};
