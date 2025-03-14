import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { NinLoginForm } from "@/components/nin-login-form";
import { LivenessCheck } from "@/components/liveness-check";
import { UserInfoCard } from "@/components/user-info-card";
import { CandidateGrid } from "@/components/candidate-grid";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { TransactionConfirmation } from "@/components/transaction-confirmation";
import { NoActiveElection } from "@/components/no-active-election";
import { useMetaMask } from "@/hooks/use-metamask";
import { castVote, getActiveElectionId, getElectionInfo, getAllCandidates, hashNIN } from "@/utils/blockchain";
import type { Candidate } from "@/types/candidate";

enum VotingStep {
  NIN_ENTRY,
  LIVENESS_CHECK,
  CANDIDATE_SELECTION,
  TRANSACTION_CONFIRMATION
}

export default function Vote() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(VotingStep.NIN_ENTRY);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionHash, setTransactionHash] = useState("");
  const [transactionTimestamp, setTransactionTimestamp] = useState("");
  const [voterNIN, setVoterNIN] = useState<string>("");

  // Use MetaMask hook for wallet integration
  const { isConnected, connect, account } = useMetaMask();

  // Query for election data
  const { data: electionData, isLoading: loadingElection } = useQuery({
    queryKey: ['activeElection'],
    queryFn: async () => {
      const activeElectionId = await getActiveElectionId();
      if (!activeElectionId) return null;

      const electionInfo = await getElectionInfo(activeElectionId);
      if (!electionInfo || !electionInfo.active) return null;

      const candidates = await getAllCandidates(activeElectionId);

      return {
        electionId: activeElectionId,
        info: electionInfo,
        candidates
      };
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 60000, // Only refetch every minute
  });

  const handleSelectCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
  };

  const handleCastVote = async () => {
    if (!selectedCandidate || !electionData?.electionId) return;

    setIsSubmitting(true);

    try {
      // First connect to MetaMask if not connected
      if (!isConnected) {
        await connect();
      }

      // Only proceed if connection was successful
      if (isConnected && account) {
        // Hash the voter's NIN for privacy
        const voterNINHash = await hashNIN(voterNIN);

        // Cast the vote on the blockchain
        const result = await castVote(
          electionData.electionId,
          selectedCandidate.index,
          voterNINHash
        );

        if (result.success && result.transactionHash) {
          setTransactionHash(result.transactionHash);
          setTransactionTimestamp(new Date().toLocaleString());
          setHasVoted(true);
          setCurrentStep(VotingStep.TRANSACTION_CONFIRMATION);

          toast({
            title: "Vote submitted",
            description: "Your vote has been recorded on the blockchain"
          });
        } else {
          throw new Error(result.error);
        }
      }
    } catch (error: any) {
      console.error("Vote casting error:", error);
      toast({
        title: "Error submitting vote",
        description: error.message || "There was an error connecting to your wallet",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render different content based on step
  const renderContent = () => {
    if (loadingElection) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading election data...</p>
        </div>
      );
    }

    if (!electionData?.info) {
      return <NoActiveElection />;
    }

    if (hasVoted) {
      return (
        <TransactionConfirmation
          transactionHash={transactionHash}
          candidateName={selectedCandidate?.name || ""}
          timestamp={transactionTimestamp}
        />
      );
    }

    switch (currentStep) {
      case VotingStep.NIN_ENTRY:
        return (
          <NinLoginForm 
            onComplete={(nin: string) => {
              setVoterNIN(nin);
              setCurrentStep(VotingStep.LIVENESS_CHECK);
            }} 
          />
        );

      case VotingStep.LIVENESS_CHECK:
        return (
          <LivenessCheck onComplete={() => setCurrentStep(VotingStep.CANDIDATE_SELECTION)} />
        );

      case VotingStep.CANDIDATE_SELECTION:
        return (
          <div className="space-y-6 max-w-6xl mx-auto">
            <UserInfoCard userInfo={{ nin: voterNIN }} />

            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Select a Candidate</h2>
              <p className="text-gray-600">Choose one candidate from the list below</p>
            </div>

            <CandidateGrid
              candidates={electionData.candidates}
              onSelectCandidate={handleSelectCandidate}
              selectedCandidateId={selectedCandidate?.index || null}
            />

            {selectedCandidate && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                <div>
                  <h3 className="text-sm font-medium">Ready to cast your vote for:</h3>
                  <p className="font-semibold text-lg">{selectedCandidate.name} ({selectedCandidate.party})</p>
                </div>
                <Button
                  size="lg"
                  onClick={handleCastVote}
                  className="w-full sm:w-auto"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    <>
                      {isConnected ? "Cast Vote" : "Connect Wallet & Cast Vote"}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {renderContent()}
        </div>
      </main>

      <Footer />
    </div>
  );
}