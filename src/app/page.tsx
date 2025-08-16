"use client";

import { useState, useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement
);

interface Repository {
  id: string;
  name: string;
  path: string;
  clonedAt: string;
}

interface Commit {
  hash: string;
  date: string;
  author: string;
  message: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  complexity: number;
  semanticCategory: string;
  businessImpact: string;
}

interface AnalysisData {
  commits: Commit[];
  complexityTrends: { date: string; complexity: number }[];
  authorContributions: { author: string; commits: number; linesChanged: number }[];
  businessFeatures: { feature: string; commits: string[]; timeline: string[] }[];
}

interface AIInsight {
  type: 'trend' | 'anomaly' | 'suggestion' | 'risk';
  title: string;
  description: string;
  data?: unknown;
  severity: 'low' | 'medium' | 'high';
}

interface DateRange {
  start: string;
  end: string;
}

interface ChartFilters {
  dateRange: DateRange;
  authors: string[];
  complexityThreshold: number;
}

export default function Home() {
  // Core state
  const [repoUrl, setRepoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  
  // Modern UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [modalChart, setModalChart] = useState<string | null>(null);
  
  // Natural Language Query state
  const [nlQuery, setNlQuery] = useState("");
  const [nlResponse, setNlResponse] = useState("");
  const [isLoadingNL, setIsLoadingNL] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [showNLInterface, setShowNLInterface] = useState(false);
  
  // AI Insights state
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isAdditionalInsightsExpanded, setIsAdditionalInsightsExpanded] = useState(false);
  
  // Reference for AI query section
  const aiQueryRef = useRef<HTMLDivElement>(null);
  
  // Chart filtering state
  const [chartFilters, setChartFilters] = useState<ChartFilters>({
    dateRange: { start: '', end: '' },
    authors: [],
    complexityThreshold: 50
  });
  const [showFilters, setShowFilters] = useState(false);
  

  const fetchRepositories = async () => {
    setIsLoadingRepos(true);
    try {
      const response = await fetch("/api/repositories");
      const data = await response.json();
      setRepositories(data.repositories || []);
    } catch (error) {
      console.error("Failed to fetch repositories:", error);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  useEffect(() => {
    fetchRepositories();
  }, []);

  // Update chart filters when analysis data changes
  useEffect(() => {
    if (analysisData && analysisData.complexityTrends.length > 0) {
      // Get the minimum complexity value to show all data by default
      const minComplexity = Math.min(...analysisData.complexityTrends.map((d: { complexity: number }) => d.complexity));
      
      // Get all unique authors in alphabetical order
      const allAuthors = analysisData.authorContributions
        .map((a: { author: string }) => a.author)
        .sort((a, b) => a.localeCompare(b));
      
      setChartFilters({
        dateRange: { start: '', end: '' },
        authors: allAuthors, // Select all authors by default
        complexityThreshold: Math.max(0, Math.floor(minComplexity) - 1) // Set slightly below minimum to include all data, ensure integer
      });
    }
  }, [analysisData]);

  // Generate AI insights from analysis data
  const generateAIInsights = (data: AnalysisData): AIInsight[] => {
    const insights: AIInsight[] = [];
    
    // Complexity trend analysis
    if (data.complexityTrends.length > 1) {
      const recent = data.complexityTrends.slice(-5);
      const trend = recent[recent.length - 1].complexity - recent[0].complexity;
      
      if (trend > 20) {
        insights.push({
          type: 'risk',
          title: 'Rising Code Complexity',
          description: `Code complexity has increased by ${trend.toFixed(1)} points in recent commits. Consider refactoring.`,
          severity: 'high'
        });
      } else if (trend < -10) {
        insights.push({
          type: 'suggestion',
          title: 'Code Quality Improvement',
          description: `Great job! Code complexity has decreased by ${Math.abs(trend).toFixed(1)} points recently.`,
          severity: 'low'
        });
      }
    }
    
    // Author contribution analysis
    const totalCommits = data.authorContributions.reduce((sum, author) => sum + author.commits, 0);
    const mainContributor = data.authorContributions[0];
    
    if (mainContributor && mainContributor.commits / totalCommits > 0.8) {
      insights.push({
        type: 'risk',
        title: 'High Bus Factor Risk',
        description: `${mainContributor.author} owns ${((mainContributor.commits / totalCommits) * 100).toFixed(1)}% of commits. Consider distributing knowledge.`,
        severity: 'medium'
      });
    }
    
    // Business feature analysis
    if (data.businessFeatures.length > 0) {
      const mostActiveFeature = data.businessFeatures.reduce((max, feature) => 
        feature.commits.length > max.commits.length ? feature : max
      );
      
      insights.push({
        type: 'trend',
        title: 'Most Active Feature',
        description: `"${mostActiveFeature.feature}" has the most development activity with ${mostActiveFeature.commits.length} commits.`,
        severity: 'low'
      });
    }
    
    return insights;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      setMessage("Please enter a GitHub repository URL");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/clone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repoUrl }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.alreadyExists) {
          setMessage(`Repository already cloned: ${data.folderName}`);
        } else {
          setMessage(data.message);
        }
        setRepoUrl("");
        
        // Refresh repositories list and auto-select the repository
        await fetchRepositories();
        
        // Auto-select and analyze the repository (whether newly cloned or existing)
        setSelectedRepo(data.folderName);
        // Small delay to ensure state updates, then start analysis
        setTimeout(() => {
          fetchAnalysis(data.folderName);
        }, 100);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Failed to add repository");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAnalysis = async (repoId: string) => {
    setIsLoadingAnalysis(true);
    setIsLoadingInsights(true);
    try {
      const response = await fetch(`/api/analyze/${repoId}`);
      const data = await response.json();
      if (response.ok) {
        setAnalysisData(data);
        // Generate AI insights
        const insights = generateAIInsights(data);
        setAiInsights(insights);
        
        // Set default date range for filtering
        if (data.complexityTrends.length > 0) {
          const dates = data.complexityTrends.map((d: { date: string }) => d.date).sort();
          setChartFilters(prev => ({
            ...prev,
            dateRange: {
              start: dates[0],
              end: dates[dates.length - 1]
            },
            authors: data.authorContributions.map((a: { author: string }) => a.author)
          }));
        }
      } else {
        console.error("Failed to fetch analysis:", data.error);
        setAnalysisData(null);
        setAiInsights([]);
      }
    } catch (error) {
      console.error("Analysis fetch error:", error);
      setAnalysisData(null);
      setAiInsights([]);
    } finally {
      setIsLoadingAnalysis(false);
      setIsLoadingInsights(false);
    }
  };

  const handleSelectRepo = (repoId: string) => {
    if (selectedRepo === repoId) {
      setSelectedRepo(null);
      setAnalysisData(null);
    } else {
      setSelectedRepo(repoId);
      fetchAnalysis(repoId);
    }
  };

  const handleDeleteRepo = async (repoId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent repo selection when clicking delete
    
    if (!confirm(`Are you sure you want to delete the repository "${repoId}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/repositories/${repoId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // If deleted repo was selected, clear selection
        if (selectedRepo === repoId) {
          setSelectedRepo(null);
          setAnalysisData(null);
        }
        // Refresh the repository list
        fetchRepositories();
      } else {
        alert('Failed to delete repository');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete repository');
    }
  };

  // Natural Language Query Handler
  const handleNLSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlQuery.trim() || !selectedRepo) {
      return;
    }

    const currentQuery = nlQuery.trim();
    setLastQuery(currentQuery);
    setNlQuery(""); // Clear the input field
    setNlResponse(""); // Clear the previous AI response
    setIsLoadingNL(true);
    
    try {
      const response = await fetch(`/api/query/${selectedRepo}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: `Please analyze this repository and answer: ${currentQuery}. Use the analysis data to provide specific insights about trends, patterns, and recommendations.`,
          includeAnalysis: true
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setNlResponse(data.response);
      } else {
        setNlResponse(`Error: ${data.error}`);
      }
    } catch {
      setNlResponse('Failed to get response from AI');
    } finally {
      setIsLoadingNL(false);
    }
  };

  // Handle Enter key press in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoadingNL && nlQuery.trim()) {
        const formEvent = { preventDefault: () => {} } as React.FormEvent;
        handleNLSubmit(formEvent);
      }
    }
  };

  // Handle Ask AI Anything button click with auto-scroll
  const handleAskAIClick = () => {
    setShowNLInterface(true);
    // Scroll to AI query section after a brief delay to ensure the section is rendered
    setTimeout(() => {
      aiQueryRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 100);
  };

  // Parse AI response to separate first sentence from rest of content
  const parseAIResponse = (response: string) => {
    // Find the first sentence ending with . ! or ?
    const firstSentencePattern = /^[^.!?]*[.!?]/;
    const match = response.match(firstSentencePattern);
    
    if (match && match[0].length < response.length) {
      const firstSentence = match[0].trim();
      const remainingContent = response.substring(match[0].length).trim();
      
      // Only make it collapsible if there's substantial content after the first sentence
      if (remainingContent.length > 50) {
        return {
          hasAdditionalContent: true,
          firstSentence,
          remainingContent,
          triggerText: 'Read more...'
        };
      }
    }
    
    return {
      hasAdditionalContent: false,
      firstSentence: response,
      remainingContent: '',
      triggerText: ''
    };
  };


  // Filter data based on current filters
  const getFilteredData = () => {
    if (!analysisData) return null;

    const { dateRange, authors, complexityThreshold } = chartFilters;
    
    let filteredComplexity = analysisData.complexityTrends;
    // Sort author contributions alphabetically
    let filteredContributions = [...analysisData.authorContributions].sort((a, b) => 
      a.author.localeCompare(b.author)
    );
    
    // Apply date range filter
    if (dateRange.start && dateRange.end) {
      filteredComplexity = filteredComplexity.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= new Date(dateRange.start) && itemDate <= new Date(dateRange.end);
      });
    }
    
    // Apply complexity threshold filter
    filteredComplexity = filteredComplexity.filter(item => item.complexity >= complexityThreshold);
    
    // Apply author filter - maintain order and show zeros for unselected authors
    if (authors.length > 0 && authors.length < analysisData.authorContributions.length) {
      filteredContributions = filteredContributions.map(contrib => 
        authors.includes(contrib.author) 
          ? contrib 
          : { ...contrib, commits: 0, linesChanged: 0 }
      );
    }
    
    return {
      ...analysisData,
      complexityTrends: filteredComplexity,
      authorContributions: filteredContributions
    };
  };

  const filteredData = getFilteredData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white shadow-sm border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">Codebase Time Machine</h1>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="lg:flex min-h-screen">
        {/* Mobile Sidebar Overlay */}
        <div className={`
          lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity duration-300
          ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `} onClick={() => setIsSidebarOpen(false)}></div>
        
        {/* Sidebar */}
        <div className={`
          fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
          w-80 bg-white shadow-xl lg:shadow-lg h-screen lg:h-auto
          transform lg:transform-none transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:flex-shrink-0
        `}>
          {/* Sidebar Header */}
          <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-purple-600">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Repositories</h2>
                <p className="text-blue-100 text-sm">{repositories.length} projects</p>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-2 rounded-md text-blue-100 hover:text-white hover:bg-blue-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={fetchRepositories}
                disabled={isLoadingRepos}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{isLoadingRepos ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>

            {isLoadingRepos ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading repositories...</span>
              </div>
            ) : repositories.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No repositories</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by cloning your first repository.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {repositories.map((repo) => (
                  <div
                    key={repo.id}
                    onClick={() => handleSelectRepo(repo.id)}
                    className={`group p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedRepo === repo.id
                        ? "border-blue-500 bg-gradient-to-r from-blue-50 to-purple-50 shadow-md"
                        : "border-gray-200 hover:border-blue-300 hover:bg-gray-50 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" clipRule="evenodd" />
                          </svg>
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {repo.name}
                          </p>
                          {selectedRepo === repo.id && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2 flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {new Date(repo.clonedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="ml-2 flex-shrink-0 flex items-center space-x-2">
                        <button
                          onClick={(e) => handleDeleteRepo(repo.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all duration-200"
                          title="Delete repository"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-screen overflow-hidden lg:ml-0">
          {/* Header with Natural Language Interface */}
          <div className="hidden lg:block bg-white border-b shadow-sm">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Codebase Time Machine
                  </h1>
                  <p className="text-gray-600 text-sm">AI-powered repository analysis and insights</p>
                </div>
                {selectedRepo && (
                  <button
                    onClick={handleAskAIClick}
                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-md"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>Ask AI Anything</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-6 py-6">

            {/* Add GitHub Repository Form */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 mb-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Add GitHub Repository</h2>
                <p className="text-gray-600">Add a GitHub repository to analyze with AI-powered insights</p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700 mb-2">
                    GitHub Repository URL
                  </label>
                  <div className="relative">
                    <input
                      id="repoUrl"
                      type="url"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/username/repository"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl shadow-sm placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      disabled={isLoading}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center py-3 px-6 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Adding Repository...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Repository
                    </>
                  )}
                </button>
              </form>

              {message && (
                <div className={`mt-6 p-4 rounded-xl border ${
                  message.startsWith("Error") || message.startsWith("Failed")
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-green-50 text-green-700 border-green-200"
                }`}>
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      {message.startsWith("Error") || message.startsWith("Failed") ? (
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <p className="ml-3 text-sm font-medium">{message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* AI Insights Dashboard */}
            {selectedRepo && aiInsights.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">AI Insights</h2>
                    <p className="text-gray-600">Automated analysis and recommendations</p>
                  </div>
                  {isLoadingInsights && (
                    <div className="flex items-center space-x-2 text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm">Generating insights...</span>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {aiInsights.map((insight, index) => (
                    <div
                      key={index}
                      className={`p-6 rounded-2xl border-2 shadow-lg transition-all duration-200 hover:shadow-xl ${
                        insight.severity === 'high' 
                          ? 'bg-red-50 border-red-200 hover:border-red-300'
                          : insight.severity === 'medium'
                          ? 'bg-yellow-50 border-yellow-200 hover:border-yellow-300'
                          : 'bg-green-50 border-green-200 hover:border-green-300'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          insight.type === 'risk' 
                            ? 'bg-red-500'
                            : insight.type === 'suggestion'
                            ? 'bg-green-500'
                            : insight.type === 'trend'
                            ? 'bg-blue-500'
                            : 'bg-purple-500'
                        }`}>
                          {insight.type === 'risk' ? (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L3.172 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                          ) : insight.type === 'suggestion' ? (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-gray-900 mb-1">
                            {insight.title}
                          </h3>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {insight.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Natural Language Query Interface */}
            {showNLInterface && selectedRepo && (
              <div ref={aiQueryRef} className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl border border-purple-200 overflow-hidden shadow-lg">
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">AI Assistant</h3>
                        <p className="text-purple-100 text-sm">Ask anything about your repository</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowNLInterface(false)}
                      className="text-white hover:text-purple-200 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="p-6">
                  <form onSubmit={handleNLSubmit} className="space-y-4">
                    <div className="relative">
                      <textarea
                        value={nlQuery}
                        onChange={(e) => setNlQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Try asking: 'What are the main trends in this codebase?', 'Who are the most active contributors?', 'What should I focus on for code quality improvement?'"
                        className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl shadow-sm placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none bg-white"
                        rows={3}
                        disabled={isLoadingNL}
                      />
                      <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                        <span className="text-xs text-gray-400">Press Enter to send</span>
                      </div>
                    </div>
                    
                    <button
                      type="submit"
                      disabled={isLoadingNL || !nlQuery.trim()}
                      className="w-full flex items-center justify-center py-3 px-6 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {isLoadingNL ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Thinking...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Ask AI
                        </>
                      )}
                    </button>
                  </form>

                  {/* AI Response */}
                  {(nlResponse || lastQuery) && (
                    <div className="mt-6 space-y-4">
                      {/* User Query Display */}
                      {lastQuery && (
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-gray-900 mb-2">Your Question:</h4>
                              <div className="text-sm text-gray-700 leading-relaxed">
                                {lastQuery}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* AI Response */}
                      {nlResponse && (() => {
                        const parsedResponse = parseAIResponse(nlResponse);
                        
                        return (
                          <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-start space-x-3">
                              <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <h4 className="text-sm font-semibold text-gray-900 mb-2">AI Analysis:</h4>
                                
                                {/* First Sentence */}
                                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                  {parsedResponse.firstSentence}
                                </div>
                                
                                {/* Remaining Content Section */}
                                {parsedResponse.hasAdditionalContent && (
                                  <div className="mt-4">
                                    <button
                                      onClick={() => setIsAdditionalInsightsExpanded(!isAdditionalInsightsExpanded)}
                                      className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors duration-200"
                                    >
                                      <div className={`transform transition-transform duration-200 ${isAdditionalInsightsExpanded ? 'rotate-90' : ''}`}>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                      </div>
                                      <span className="text-sm font-medium">{parsedResponse.triggerText}</span>
                                    </button>
                                    
                                    {isAdditionalInsightsExpanded && (
                                      <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                        {parsedResponse.remainingContent}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Repository Analysis Section */}
            {selectedRepo && (
              <div className="space-y-8">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
                    <div className="mb-4 lg:mb-0">
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                        Repository Analysis
                      </h2>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span className="font-semibold">{repositories.find(r => r.id === selectedRepo)?.name}</span>
                      </div>
                    </div>
                    
                    {/* Chart Filters Toggle */}
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                        </svg>
                        <span>Filters</span>
                      </button>
                      
                      {!showNLInterface && (
                        <button
                          onClick={handleAskAIClick}
                          className="lg:hidden flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-md"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span>Ask AI</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Chart Filters Panel */}
                  {showFilters && filteredData && (
                    <div className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Chart Filters</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Date Range Filter */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                          <div className="space-y-2">
                            <input
                              type="date"
                              value={chartFilters.dateRange.start}
                              onChange={(e) => setChartFilters(prev => ({
                                ...prev,
                                dateRange: { ...prev.dateRange, start: e.target.value }
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                            <input
                              type="date"
                              value={chartFilters.dateRange.end}
                              onChange={(e) => setChartFilters(prev => ({
                                ...prev,
                                dateRange: { ...prev.dateRange, end: e.target.value }
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>

                        {/* Complexity Threshold */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Complexity Threshold: {chartFilters.complexityThreshold}
                          </label>
                          <input
                            type="range"
                            min="0"
                            max={analysisData ? Math.ceil(Math.max(...analysisData.complexityTrends.map((d: { complexity: number }) => d.complexity))) : 100}
                            value={chartFilters.complexityThreshold}
                            onChange={(e) => setChartFilters(prev => ({
                              ...prev,
                              complexityThreshold: parseInt(e.target.value)
                            }))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0</span>
                            <span>{analysisData ? Math.round(Math.ceil(Math.max(...analysisData.complexityTrends.map((d: { complexity: number }) => d.complexity))) / 2) : 50}</span>
                            <span>{analysisData ? Math.ceil(Math.max(...analysisData.complexityTrends.map((d: { complexity: number }) => d.complexity))) : 100}</span>
                          </div>
                        </div>

                        {/* Author Filter */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Authors</label>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {analysisData?.authorContributions
                              .slice()
                              .sort((a, b) => a.author.localeCompare(b.author))
                              .map(author => (
                              <label key={author.author} className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={chartFilters.authors.includes(author.author)}
                                  onChange={(e) => {
                                    const newAuthors = e.target.checked
                                      ? [...chartFilters.authors, author.author]
                                      : chartFilters.authors.filter(a => a !== author.author);
                                    setChartFilters(prev => ({ ...prev, authors: newAuthors }));
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700 truncate">{author.author}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => {
                            if (analysisData) {
                              const dates = analysisData.complexityTrends.map((d: { date: string }) => d.date).sort();
                              setChartFilters({
                                dateRange: {
                                  start: dates[0] || '',
                                  end: dates[dates.length - 1] || ''
                                },
                                authors: analysisData.authorContributions.map((a: { author: string }) => a.author),
                                complexityThreshold: 0
                              });
                            }
                          }}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                          Reset Filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>


                {isLoadingAnalysis ? (
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Analyzing Repository</h3>
                      <p className="text-gray-600">Processing commits and generating insights...</p>
                    </div>
                  </div>
                ) : analysisData ? (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* Code Complexity Trends */}
                    <div className="group bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => setModalChart('complexity')}>
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">Code Complexity</h3>
                              <p className="text-sm text-gray-600">Trends over time</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 text-blue-600 group-hover:text-blue-700">
                            <span className="text-sm font-medium">Expand</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="h-72">
                          <Line
                            data={{
                              labels: ((filteredData || analysisData)?.complexityTrends || []).map((d: { date: string }) => 
                                new Date(d.date).toLocaleDateString()
                              ),
                              datasets: [{
                                label: 'Complexity Score',
                                data: ((filteredData || analysisData)?.complexityTrends || []).map((d: { complexity: number }) => d.complexity),
                                borderColor: 'rgb(59, 130, 246)',
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                borderWidth: 3,
                                pointBackgroundColor: 'rgb(59, 130, 246)',
                                pointBorderColor: '#fff',
                                pointBorderWidth: 2,
                                pointRadius: 5,
                                pointHoverRadius: 8,
                                fill: true,
                                tension: 0.4,
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              interaction: {
                                intersect: false,
                                mode: 'index'
                              },
                              plugins: {
                                legend: {
                                  display: false
                                },
                                tooltip: {
                                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                  titleColor: '#fff',
                                  bodyColor: '#fff',
                                  borderColor: 'rgb(59, 130, 246)',
                                  borderWidth: 1,
                                  cornerRadius: 8,
                                  displayColors: false,
                                  callbacks: {
                                    title: function(context) {
                                      return `Date: ${context[0].label}`;
                                    },
                                    label: function(context) {
                                      const value = context.parsed.y;
                                      let status = 'Low';
                                      if (value > 70) status = 'High';
                                      else if (value > 40) status = 'Medium';
                                      
                                      return [
                                        `Complexity: ${value}/100`,
                                        `Status: ${status} complexity`,
                                        `Recommendation: ${value > 70 ? 'Consider refactoring' : value > 40 ? 'Monitor closely' : 'Good code quality'}`
                                      ];
                                    }
                                  }
                                }
                              },
                              scales: {
                                x: {
                                  grid: {
                                    display: false
                                  },
                                  ticks: {
                                    maxTicksLimit: 6
                                  }
                                },
                                y: {
                                  beginAtZero: true,
                                  max: 100,
                                  grid: {
                                    color: 'rgba(0, 0, 0, 0.05)'
                                  },
                                  ticks: {
                                    callback: function(value) {
                                      return value + '/100';
                                    }
                                  }
                                }
                              }
                            }}
                          />
                        </div>
                        <div className="mt-4 flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span className="text-gray-600">Low (0-40)</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                              <span className="text-gray-600">Medium (41-70)</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                              <span className="text-gray-600">High (71-100)</span>
                            </div>
                          </div>
                          <span className="text-gray-500">{analysisData?.complexityTrends?.length || 0} data points</span>
                        </div>
                      </div>
                    </div>

                    {/* Author Contributions */}
                    <div className="group bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={() => setModalChart('ownership')}>
                      <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-emerald-600 to-green-600 rounded-full flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">Code Ownership</h3>
                              <p className="text-sm text-gray-600">Author contributions</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 text-emerald-600 group-hover:text-emerald-700">
                            <span className="text-sm font-medium">Expand</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="h-72">
                          <Bar
                            data={{
                              labels: ((filteredData || analysisData)?.authorContributions || []).map((a: { author: string }) => 
                                a.author.length > 10 ? a.author.substring(0, 10) + '...' : a.author
                              ),
                              datasets: [
                                {
                                  label: 'Commits',
                                  data: ((filteredData || analysisData)?.authorContributions || []).map((a: { commits: number }) => a.commits),
                                  backgroundColor: 'rgba(59, 130, 246, 0.8)',
                                  borderColor: 'rgba(59, 130, 246, 1)',
                                  borderWidth: 1,
                                  borderRadius: 6,
                                },
                                {
                                  label: 'Lines Changed',
                                  data: ((filteredData || analysisData)?.authorContributions || []).map((a: { linesChanged: number }) => a.linesChanged),
                                  backgroundColor: 'rgba(16, 185, 129, 0.8)',
                                  borderColor: 'rgba(16, 185, 129, 1)',
                                  borderWidth: 1,
                                  borderRadius: 6,
                                }
                              ]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              interaction: {
                                intersect: false,
                                mode: 'index'
                              },
                              plugins: {
                                legend: {
                                  display: true,
                                  position: 'top',
                                  align: 'end',
                                  labels: {
                                    usePointStyle: true,
                                    pointStyle: 'circle',
                                    padding: 15,
                                    font: {
                                      size: 12,
                                      weight: 'bold'
                                    }
                                  }
                                },
                                tooltip: {
                                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                  titleColor: '#fff',
                                  bodyColor: '#fff',
                                  borderColor: 'rgba(59, 130, 246, 0.5)',
                                  borderWidth: 1,
                                  cornerRadius: 8,
                                  displayColors: true,
                                  callbacks: {
                                    title: function(context) {
                                      const authorContribs = ((filteredData || analysisData)?.authorContributions || []);
                                      const author = authorContribs[context[0].dataIndex];
                                      return `Author: ${author?.author || 'Unknown'}`;
                                    },
                                    label: function(context) {
                                      const authorContribs = ((filteredData || analysisData)?.authorContributions || []);
                                      const author = authorContribs[context.dataIndex];
                                      if (!author) return '';
                                      const totalCommits = authorContribs.reduce((sum, a) => sum + a.commits, 0);
                                      const totalLines = authorContribs.reduce((sum, a) => sum + a.linesChanged, 0);
                                      
                                      if (context.datasetIndex === 0) {
                                        const percentage = ((author.commits / totalCommits) * 100).toFixed(1);
                                        return [
                                          `Commits: ${author.commits}`,
                                          `Contribution: ${percentage}% of total commits`,
                                          `Average: ${(author.linesChanged / author.commits).toFixed(0)} lines per commit`
                                        ];
                                      } else {
                                        const percentage = ((author.linesChanged / totalLines) * 100).toFixed(1);
                                        return [
                                          `Lines Changed: ${author.linesChanged.toLocaleString()}`,
                                          `Contribution: ${percentage}% of total changes`
                                        ];
                                      }
                                    }
                                  }
                                }
                              },
                              scales: {
                                x: {
                                  grid: {
                                    display: false
                                  },
                                  ticks: {
                                    maxRotation: 45,
                                    minRotation: 0
                                  }
                                },
                                y: {
                                  beginAtZero: true,
                                  grid: {
                                    color: 'rgba(0, 0, 0, 0.05)'
                                  },
                                  ticks: {
                                    callback: function(value) {
                                      return value.toLocaleString();
                                    }
                                  }
                                }
                              }
                            }}
                          />
                        </div>
                        <div className="mt-4 flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <span className="text-gray-600">Commits</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                              <span className="text-gray-600">Lines Changed</span>
                            </div>
                          </div>
                          <span className="text-gray-500">{analysisData?.authorContributions?.length || 0} contributors</span>
                        </div>
                      </div>
                    </div>

                    {/* Business Features Timeline - Full Width */}
                    <div className="xl:col-span-2 group bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">Business Features</h3>
                              <p className="text-sm text-gray-600">Development activity by feature</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setModalChart('business')}
                            className="flex items-center space-x-2 text-purple-600 group-hover:text-purple-700 hover:bg-purple-100 px-3 py-1 rounded-lg transition-all duration-200"
                          >
                            <span className="text-sm font-medium">Expand</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-6">
                        <div className="h-80">
                          <Bar
                            data={{
                              labels: ((filteredData || analysisData)?.businessFeatures || []).map((f: { feature: string }) => 
                                f.feature.length > 15 ? f.feature.substring(0, 15) + '...' : f.feature
                              ),
                              datasets: [{
                                label: 'Number of Commits',
                                data: ((filteredData || analysisData)?.businessFeatures || []).map((f: { commits: string[] }) => f.commits.length),
                                backgroundColor: [
                                  'rgba(59, 130, 246, 0.8)',
                                  'rgba(16, 185, 129, 0.8)', 
                                  'rgba(245, 101, 101, 0.8)',
                                  'rgba(251, 191, 36, 0.8)',
                                  'rgba(139, 92, 246, 0.8)',
                                  'rgba(236, 72, 153, 0.8)',
                                  'rgba(34, 197, 94, 0.8)',
                                  'rgba(239, 68, 68, 0.8)',
                                  'rgba(168, 85, 247, 0.8)'
                                ],
                                borderColor: [
                                  'rgba(59, 130, 246, 1)',
                                  'rgba(16, 185, 129, 1)', 
                                  'rgba(245, 101, 101, 1)',
                                  'rgba(251, 191, 36, 1)',
                                  'rgba(139, 92, 246, 1)',
                                  'rgba(236, 72, 153, 1)',
                                  'rgba(34, 197, 94, 1)',
                                  'rgba(239, 68, 68, 1)',
                                  'rgba(168, 85, 247, 1)'
                                ],
                                borderWidth: 2,
                                borderRadius: 8,
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              interaction: {
                                intersect: false,
                                mode: 'index'
                              },
                              plugins: {
                                legend: {
                                  display: false,
                                },
                                tooltip: {
                                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                  titleColor: '#fff',
                                  bodyColor: '#fff',
                                  borderColor: 'rgba(139, 92, 246, 0.5)',
                                  borderWidth: 1,
                                  cornerRadius: 8,
                                  displayColors: false,
                                  callbacks: {
                                    title: function(context) {
                                      const feature = (analysisData?.businessFeatures || [])[context[0].dataIndex];
                                      return `Feature: ${feature?.feature || 'Unknown'}`;
                                    },
                                    label: function(context) {
                                      const feature = (analysisData?.businessFeatures || [])[context.dataIndex];
                                      if (!feature) return '';
                                      const totalCommits = (analysisData?.businessFeatures || []).reduce((sum, f) => sum + f.commits.length, 0);
                                      const percentage = ((feature.commits.length / totalCommits) * 100).toFixed(1);
                                      
                                      return [
                                        `Commits: ${context.parsed.y}`,
                                        `Activity: ${percentage}% of total feature work`,
                                        `Timeline: ${new Date(feature.timeline[0]).toLocaleDateString()} - ${new Date(feature.timeline[feature.timeline.length - 1]).toLocaleDateString()}`,
                                        `Duration: ${Math.ceil((new Date(feature.timeline[feature.timeline.length - 1]).getTime() - new Date(feature.timeline[0]).getTime()) / (1000 * 60 * 60 * 24))} days`
                                      ];
                                    }
                                  }
                                }
                              },
                              scales: {
                                x: {
                                  grid: {
                                    display: false
                                  },
                                  ticks: {
                                    maxRotation: 45,
                                    minRotation: 0,
                                    font: {
                                      size: 11
                                    }
                                  }
                                },
                                y: {
                                  beginAtZero: true,
                                  grid: {
                                    color: 'rgba(0, 0, 0, 0.05)'
                                  },
                                  title: {
                                    display: true,
                                    text: 'Number of Commits',
                                    font: {
                                      size: 12,
                                      weight: 'bold'
                                    }
                                  }
                                }
                              }
                            }}
                          />
                        </div>
                        <div className="mt-4 flex items-center justify-between text-sm">
                          <div className="text-gray-600">
                            <span className="font-medium">Total Features:</span> {(analysisData?.businessFeatures || []).length}
                          </div>
                          <div className="text-gray-600">
                            <span className="font-medium">Total Feature Commits:</span> {(analysisData?.businessFeatures || []).reduce((sum, f) => sum + f.commits.length, 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12">
                    <div className="text-center">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Analysis Failed</h3>
                      <p className="text-gray-600 mb-4">Unable to analyze repository. Please try again.</p>
                      <button
                        onClick={() => selectedRepo && fetchAnalysis(selectedRepo)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Retry Analysis
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal for expanded charts */}
        {modalChart && analysisData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {modalChart === 'complexity' ? 'Code Complexity Over Time' : 
                   modalChart === 'ownership' ? 'Code Ownership Analysis' : 
                   'Business Features Development Activity'}
                </h2>
                <button
                  onClick={() => setModalChart(null)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="h-96">
                {modalChart === 'complexity' ? (
                  <Line
                    data={{
                      labels: ((filteredData || analysisData)?.complexityTrends || []).map((d: { date: string }) => 
                        new Date(d.date).toLocaleDateString()
                      ),
                      datasets: [{
                        label: 'Complexity Score',
                        data: ((filteredData || analysisData)?.complexityTrends || []).map((d: { complexity: number }) => d.complexity),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.1,
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 100,
                        }
                      },
                      plugins: {
                        legend: {
                          display: true,
                        },
                        tooltip: {
                          enabled: true,
                        }
                      }
                    }}
                  />
                ) : modalChart === 'ownership' ? (
                  <Bar
                    data={{
                      labels: ((filteredData || analysisData)?.authorContributions || []).map((a: { author: string }) => a.author),
                      datasets: [
                        {
                          label: 'Commits',
                          data: ((filteredData || analysisData)?.authorContributions || []).map((a: { commits: number }) => a.commits),
                          backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        },
                        {
                          label: 'Lines Changed',
                          data: ((filteredData || analysisData)?.authorContributions || []).map((a: { linesChanged: number }) => a.linesChanged),
                          backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                        }
                      },
                      plugins: {
                        legend: {
                          display: true,
                        },
                        tooltip: {
                          enabled: true,
                        }
                      }
                    }}
                  />
                ) : (
                  <Bar
                    data={{
                      labels: ((filteredData || analysisData)?.businessFeatures || []).map((f: { feature: string }) => f.feature),
                      datasets: [{
                        label: 'Number of Commits',
                        data: ((filteredData || analysisData)?.businessFeatures || []).map((f: { commits: string[] }) => f.commits.length),
                        backgroundColor: [
                          'rgba(59, 130, 246, 0.8)',
                          'rgba(16, 185, 129, 0.8)', 
                          'rgba(245, 101, 101, 0.8)',
                          'rgba(251, 191, 36, 0.8)',
                          'rgba(139, 92, 246, 0.8)',
                          'rgba(236, 72, 153, 0.8)',
                          'rgba(34, 197, 94, 0.8)',
                          'rgba(239, 68, 68, 0.8)',
                          'rgba(168, 85, 247, 0.8)'
                        ],
                        borderColor: [
                          'rgba(59, 130, 246, 1)',
                          'rgba(16, 185, 129, 1)', 
                          'rgba(245, 101, 101, 1)',
                          'rgba(251, 191, 36, 1)',
                          'rgba(139, 92, 246, 1)',
                          'rgba(236, 72, 153, 1)',
                          'rgba(34, 197, 94, 1)',
                          'rgba(239, 68, 68, 1)',
                          'rgba(168, 85, 247, 1)'
                        ],
                        borderWidth: 1
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          callbacks: {
                            title: function(context) {
                              return context[0].label;
                            },
                            label: function(context) {
                              const feature = analysisData.businessFeatures[context.dataIndex];
                              return [
                                `Commits: ${context.parsed.y}`,
                                `Timeline: ${new Date(feature.timeline[0]).toLocaleDateString()} - ${new Date(feature.timeline[feature.timeline.length - 1]).toLocaleDateString()}`
                              ];
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: 'Number of Commits'
                          }
                        },
                        x: {
                          title: {
                            display: true,
                            text: 'Business Features'
                          }
                        }
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
