import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { mockElectionData, candidateColors } from "@/data/mock-data";

export function ElectionInfoCard() {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const { currentElection, topCandidates } = mockElectionData;

  return (
    <Card className="bg-white shadow-md rounded-lg p-6 mb-8">
      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 mb-6 lg:mb-0 lg:mr-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            {currentElection.title}
          </h2>
          <div className="mb-4">
            <div className="flex items-center text-sm text-gray-500 mb-2">
              <svg className="mr-1.5 h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <span>{currentElection.dateRange}</span>
            </div>
            <div className="flex items-center text-sm text-gray-500">
              <svg className="mr-1.5 h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span>{currentElection.schedule}</span>
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            {currentElection.description}
          </p>
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Participation</h3>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-primary h-2.5 rounded-full" 
                style={{ width: `${currentElection.participationPercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>{currentElection.votesCount} votes</span>
              <span>{currentElection.eligibleVoters} eligible voters</span>
            </div>
          </div>
          <Button className="mt-2">
            Cast Your Vote
          </Button>
        </div>
        <div className="flex-1 lg:border-l lg:pl-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Real-time Results</h3>
            <div className="inline-flex shadow-sm rounded-md">
              <button 
                type="button" 
                className={`relative inline-flex items-center px-3 py-1.5 rounded-l-md border border-gray-300 ${viewMode === 'chart' ? 'bg-primary text-white' : 'bg-white text-gray-700'} text-xs font-medium hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary`}
                onClick={() => setViewMode('chart')}
              >
                Chart
              </button>
              <button 
                type="button" 
                className={`relative inline-flex items-center px-3 py-1.5 rounded-r-md border border-gray-300 ${viewMode === 'table' ? 'bg-primary text-white' : 'bg-white text-gray-700'} text-xs font-medium hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary`}
                onClick={() => setViewMode('table')}
              >
                Table
              </button>
            </div>
          </div>
          
          {viewMode === 'chart' && (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topCandidates}
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="80%"
                    paddingAngle={0}
                    dataKey="percentage"
                    nameKey="name"
                  >
                    {topCandidates.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={candidateColors[index % candidateColors.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value}%`, '']}
                    labelFormatter={(name) => `${name}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          
          <div className="mt-4 space-y-3">
            {topCandidates.map((candidate, index) => (
              <div className="flex items-center" key={index}>
                <div 
                  className="w-4 h-4 rounded-full mr-2" 
                  style={{ backgroundColor: candidateColors[index % candidateColors.length] }}
                ></div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-900">{candidate.name}</span>
                    <span className="text-sm text-gray-500">{candidate.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div 
                      className="h-1.5 rounded-full" 
                      style={{ 
                        width: `${candidate.percentage}%`,
                        backgroundColor: candidateColors[index % candidateColors.length]
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
