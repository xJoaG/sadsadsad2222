import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Search, Ban, UserCheck, Users, Loader, AlertCircle, CheckCircle, Eye, EyeOff, XCircle, Clock, MessageSquare, Mail, Globe, Image, Crown, Shield, Settings, Calendar, Activity, Filter, MoreVertical, Star, Award, BookOpen, MapPin, Phone, Edit3, Trash2, UserX, UserPlus, Lock, Unlock } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ParticleNetwork from '../components/ParticleNetwork';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const apiClient = axios.create({
    baseURL: 'https://api.cpp-hub.com/api',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
});

apiClient.interceptors.request.use(config => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

const ALL_GROUPS = ['Basic Plan', 'Premium Plan', 'Junior Support', 'Support', 'Senior Support', 'Admin', 'Owner'];

interface UserProfileData {
    id: number;
    username: string;
    name?: string;
    email?: string;
    bio: string | null;
    nationality: string | null;
    profile_picture_url: string | null;
    is_profile_public: boolean;
    group: string;
    banned_until: string | null;
    ban_reason: string | null;
    is_private?: boolean;
    message?: string;
}

const AdminPanelPage: React.FC = () => {
    const { user: currentUser, isLoading: authLoading, hasPrivilege } = useAuth();
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserProfileData[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    const [selectedUser, setSelectedUser] = useState<UserProfileData | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'moderation' | 'permissions'>('info');

    const [banReason, setBanReason] = useState('');
    const [bannedUntil, setBannedUntil] = useState('');
    const [newGroup, setNewGroup] = useState('');
    const [adminActionLoading, setAdminActionLoading] = useState(false);
    const [adminActionMessage, setAdminActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const canAccessPanel = hasPrivilege(['Junior Support', 'Support', 'Senior Support', 'Admin', 'Owner']);
    const canBan = hasPrivilege(['Admin', 'Owner', 'Senior Support']);
    const canChangeGroup = hasPrivilege(['Admin', 'Owner']);
    const canSeeFullInfo = hasPrivilege(['Admin', 'Owner', 'Senior Support']);

    useEffect(() => {
        if (!authLoading && !canAccessPanel) {
            navigate('/');
        }
    }, [authLoading, canAccessPanel, navigate]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setSearchLoading(true);
        setSearchResults([]);
        setSearchError(null);
        setSelectedUser(null);

        if (!searchQuery.trim()) {
            setSearchError('Please enter a user ID or username to search.');
            setSearchLoading(false);
            return;
        }

        try {
            let userFound = false;
            let response;
            try {
                response = await apiClient.get(`/users/${searchQuery.trim()}/profile`);
                userFound = true;
            } catch (idErr: any) {
                if (isNaN(Number(searchQuery.trim()))) {
                    response = await apiClient.get(`/users/${searchQuery.trim()}/profile`);
                    userFound = true;
                }
            }

            if (userFound && response?.data) {
                setSearchResults([response.data]);
            } else {
                setSearchError('No user found with that ID or username.');
            }
        } catch (err: any) {
            console.error('Search failed:', err);
            setSearchError(err.response?.data?.message || 'Failed to search for user. Make sure the ID/username is correct.');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleViewUserDetails = (user: UserProfileData) => {
        setSelectedUser(user);
        setModalOpen(true);
        setActiveTab('info');
        setBanReason(user.ban_reason || '');
        setBannedUntil(user.banned_until ? new Date(user.banned_until).toISOString().slice(0, 16) : '');
        setNewGroup(user.group);
        setAdminActionMessage(null);
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedUser(null);
        setAdminActionMessage(null);
        setActiveTab('info');
    };

    const handleBanUser = async (permanent: boolean = false) => {
        if (!selectedUser?.id) return;
        if ((!permanent && !bannedUntil) || !banReason) {
            setAdminActionMessage({ type: 'error', text: 'Please fill all ban fields.' });
            return;
        }
        setAdminActionLoading(true);
        setAdminActionMessage(null);
        try {
            const data: { banned_until?: string; ban_reason: string } = {
                ban_reason: banReason,
            };
            if (!permanent) {
                data.banned_until = bannedUntil;
            }
            await apiClient.post(`/admin/users/${selectedUser.id}/ban`, data);
            setAdminActionMessage({ type: 'success', text: `User ${selectedUser.username} banned successfully!` });
            setSelectedUser(prev => prev ? { ...prev, banned_until: data.banned_until || null, ban_reason: banReason } : null);
        } catch (error: any) {
            console.error('Failed to ban user:', error);
            const errorMessage = error.response?.data?.message || 'Failed to ban user. Check privileges or user ID.';
            setAdminActionMessage({ type: 'error', text: errorMessage });
        } finally {
            setAdminActionLoading(false);
        }
    };

    const handleUnbanUser = async () => {
        if (!selectedUser?.id) return;
        setAdminActionLoading(true);
        setAdminActionMessage(null);
        try {
            await apiClient.post(`/admin/users/${selectedUser.id}/unban`);
            setAdminActionMessage({ type: 'success', text: `User ${selectedUser.username} unbanned successfully!` });
            setSelectedUser(prev => prev ? { ...prev, banned_until: null, ban_reason: null } : null);
        } catch (error: any) {
            console.error('Failed to unban user:', error);
            const errorMessage = error.response?.data?.message || 'Failed to unban user. Check privileges or user ID.';
            setAdminActionMessage({ type: 'error', text: errorMessage });
        } finally {
            setAdminActionLoading(false);
        }
    };

    const handleUpdateGroup = async () => {
        if (!selectedUser?.id || !newGroup) {
            setAdminActionMessage({ type: 'error', text: 'Please select a new group.' });
            return;
        }
        setAdminActionLoading(true);
        setAdminActionMessage(null);
        try {
            await apiClient.put(`/admin/users/${selectedUser.id}/group`, { group: newGroup });
            setAdminActionMessage({ type: 'success', text: `User ${selectedUser.username} group updated to ${newGroup}!` });
            setSelectedUser(prev => prev ? { ...prev, group: newGroup } : null);
        } catch (error: any) {
            console.error('Failed to update group:', error);
            const errorMessage = error.response?.data?.message || 'Failed to update group. Check privileges or user ID.';
            setAdminActionMessage({ type: 'error', text: errorMessage });
        } finally {
            setAdminActionLoading(false);
        }
    };

    const getGroupColor = (group: string) => {
        switch (group) {
            case 'Owner': return 'from-red-500 to-orange-500';
            case 'Admin': return 'from-purple-500 to-pink-500';
            case 'Senior Support': return 'from-blue-500 to-cyan-500';
            case 'Support': return 'from-green-500 to-emerald-500';
            case 'Junior Support': return 'from-yellow-500 to-orange-500';
            case 'Premium Plan': return 'from-indigo-500 to-purple-500';
            default: return 'from-gray-500 to-gray-600';
        }
    };

    const isUserBanned = (user: UserProfileData) => {
        return user.banned_until && new Date(user.banned_until) > new Date();
    };

    if (authLoading || !canAccessPanel) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <div className="glass-morphism rounded-2xl p-8 border border-white/20 flex items-center space-x-4">
                    <Loader className="h-8 w-8 text-indigo-400 animate-spin" />
                    <p className="text-white text-lg">Loading admin panel...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden">
            <ParticleNetwork />
            <Navbar />
            
            <div className="pt-20 pb-16">
                {/* Enhanced Header */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center space-x-3 glass-morphism rounded-full px-8 py-4 mb-8 border border-white/20 shadow-lg">
                            <Shield className="h-6 w-6 text-red-400 animate-pulse" />
                            <span className="text-white font-bold text-lg">Admin Control Center</span>
                            <Settings className="h-6 w-6 text-blue-400" />
                        </div>
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6 leading-tight">
                            Admin
                            <span className="block bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent"> 
                                Dashboard
                            </span>
                        </h1>
                        <p className="text-xl text-gray-200 max-w-3xl mx-auto leading-relaxed">
                            Manage users, permissions, and platform moderation with advanced administrative tools.
                        </p>
                    </div>

                    {/* Admin Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                        <div className="glass-morphism rounded-2xl p-6 border border-white/20 hover:border-red-400/30 transition-all duration-300 group">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <Ban className="h-6 w-6 text-white" />
                                </div>
                                <span className="text-2xl font-black text-red-400">0</span>
                            </div>
                            <h3 className="text-white font-semibold mb-1">Active Bans</h3>
                            <p className="text-gray-400 text-sm">Currently banned users</p>
                        </div>

                        <div className="glass-morphism rounded-2xl p-6 border border-white/20 hover:border-blue-400/30 transition-all duration-300 group">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <Users className="h-6 w-6 text-white" />
                                </div>
                                <span className="text-2xl font-black text-blue-400">50K+</span>
                            </div>
                            <h3 className="text-white font-semibold mb-1">Total Users</h3>
                            <p className="text-gray-400 text-sm">Registered members</p>
                        </div>

                        <div className="glass-morphism rounded-2xl p-6 border border-white/20 hover:border-green-400/30 transition-all duration-300 group">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <Activity className="h-6 w-6 text-white" />
                                </div>
                                <span className="text-2xl font-black text-green-400">1.2K</span>
                            </div>
                            <h3 className="text-white font-semibold mb-1">Active Today</h3>
                            <p className="text-gray-400 text-sm">Users online now</p>
                        </div>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="glass-morphism rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
                        {/* Enhanced Search Section */}
                        <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 p-8 border-b border-white/10">
                            <div className="flex items-center space-x-3 mb-6">
                                <Search className="h-6 w-6 text-blue-400" />
                                <h2 className="text-2xl font-bold text-white">User Search & Management</h2>
                            </div>
                            
                            <form onSubmit={handleSearch} className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-white/5 border border-white/20 rounded-xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all duration-300"
                                        placeholder="Search by User ID, Username, or Email..."
                                    />
                                </div>
                                
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <button
                                        type="submit"
                                        disabled={searchLoading}
                                        className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 hover:scale-105"
                                    >
                                        {searchLoading ? <Loader className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                                        <span>{searchLoading ? 'Searching...' : 'Search User'}</span>
                                    </button>
                                    
                                    <button
                                        type="button"
                                        className="px-6 py-4 glass-morphism-dark text-white font-semibold rounded-xl border border-white/20 hover:bg-white/10 transition-all duration-300 flex items-center space-x-2"
                                    >
                                        <Filter className="h-5 w-5" />
                                        <span>Advanced Filters</span>
                                    </button>
                                </div>
                            </form>

                            {searchError && (
                                <div className="mt-4 bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3 animate-fade-in">
                                    <AlertCircle className="h-5 w-5 text-red-400" />
                                    <span className="text-red-300">{searchError}</span>
                                </div>
                            )}
                        </div>

                        {/* Enhanced Search Results */}
                        {searchResults.length > 0 && (
                            <div className="p-8">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                                    <Users className="h-5 w-5 text-blue-400" />
                                    <span>Search Results</span>
                                </h3>
                                
                                <div className="space-y-4">
                                    {searchResults.map(user => (
                                        <div key={user.id} className="glass-morphism-dark rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 group">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-4">
                                                    <div className="relative">
                                                        <img
                                                            src={user.profile_picture_url || 'https://placehold.co/64x64/000000/FFFFFF?text=U'}
                                                            alt={user.username}
                                                            className="w-16 h-16 rounded-xl object-cover border-2 border-white/20 shadow-lg"
                                                            onError={(e) => { e.currentTarget.src = 'https://placehold.co/64x64/000000/FFFFFF?text=U'; }}
                                                        />
                                                        {isUserBanned(user) && (
                                                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                                                                <Ban className="h-3 w-3 text-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="space-y-1">
                                                        <div className="flex items-center space-x-3">
                                                            <h4 className="text-white font-bold text-lg">{user.username}</h4>
                                                            <div className={`flex items-center space-x-1 bg-gradient-to-r ${getGroupColor(user.group)} px-3 py-1 rounded-full shadow-lg`}>
                                                                <Crown className="h-3 w-3 text-white" />
                                                                <span className="text-white text-xs font-medium">{user.group}</span>
                                                            </div>
                                                        </div>
                                                        <p className="text-gray-400 text-sm">ID: {user.id}</p>
                                                        {isUserBanned(user) && (
                                                            <div className="flex items-center space-x-2 text-red-400 text-xs">
                                                                <Ban className="h-3 w-3" />
                                                                <span>Banned until {new Date(user.banned_until!).toLocaleDateString()}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <button
                                                    onClick={() => handleViewUserDetails(user)}
                                                    className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 flex items-center space-x-2 shadow-lg hover:scale-105"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                    <span>Manage User</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Enhanced User Management Modal */}
                        {modalOpen && selectedUser && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg">
                                <div className="glass-morphism rounded-3xl border border-white/20 w-full max-w-6xl max-h-[90vh] shadow-2xl animate-fade-in relative overflow-hidden">
                                    {/* Modal Header */}
                                    <div className="bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 p-6 border-b border-white/10">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-6">
                                                <div className="relative">
                                                    <img
                                                        src={selectedUser.profile_picture_url || 'https://placehold.co/80x80/000000/FFFFFF?text=User'}
                                                        alt={selectedUser.username}
                                                        className="w-20 h-20 rounded-2xl object-cover border-3 border-white/30 shadow-xl"
                                                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/80x80/000000/FFFFFF?text=User'; }}
                                                    />
                                                    {isUserBanned(selectedUser) && (
                                                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                                                            <Ban className="h-3 w-3 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <h2 className="text-3xl font-bold text-white mb-2">{selectedUser.username}</h2>
                                                    <div className="flex items-center space-x-4">
                                                        <div className={`flex items-center space-x-2 bg-gradient-to-r ${getGroupColor(selectedUser.group)} px-4 py-2 rounded-full shadow-lg`}>
                                                            <Crown className="h-4 w-4 text-white" />
                                                            <span className="text-white font-medium">{selectedUser.group}</span>
                                                        </div>
                                                        <div className="text-gray-300 text-sm">
                                                            ID: <span className="text-white font-mono">{selectedUser.id}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={closeModal} 
                                                className="text-gray-400 hover:text-white p-3 rounded-full hover:bg-white/10 transition-all duration-200"
                                            >
                                                <XCircle className="h-7 w-7" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Tab Navigation */}
                                    <div className="flex border-b border-white/10 bg-white/5">
                                        <button
                                            onClick={() => setActiveTab('info')}
                                            className={`flex-1 px-6 py-4 text-center font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
                                                activeTab === 'info' 
                                                    ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/10' 
                                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            <User className="h-5 w-5" />
                                            <span>User Information</span>
                                        </button>
                                        {canBan && (
                                            <button
                                                onClick={() => setActiveTab('moderation')}
                                                className={`flex-1 px-6 py-4 text-center font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
                                                    activeTab === 'moderation' 
                                                        ? 'text-red-400 border-b-2 border-red-400 bg-red-500/10' 
                                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                }`}
                                            >
                                                <Shield className="h-5 w-5" />
                                                <span>Moderation</span>
                                            </button>
                                        )}
                                        {canChangeGroup && (
                                            <button
                                                onClick={() => setActiveTab('permissions')}
                                                className={`flex-1 px-6 py-4 text-center font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
                                                    activeTab === 'permissions' 
                                                        ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10' 
                                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                }`}
                                            >
                                                <Users className="h-5 w-5" />
                                                <span>Permissions</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                        {/* Ban Status Alert */}
                                        {isUserBanned(selectedUser) && (
                                            <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-6 mb-8 flex items-center space-x-4 animate-fade-in">
                                                <div className="p-3 bg-red-500/30 rounded-xl">
                                                    <Ban className="h-8 w-8 text-red-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-red-400 font-bold text-xl">User is currently banned</h3>
                                                    <p className="text-red-300 text-lg">Reason: {selectedUser.ban_reason}</p>
                                                    <p className="text-red-300">Until: {new Date(selectedUser.banned_until!).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Action Messages */}
                                        {adminActionMessage && (
                                            <div className={`flex items-center space-x-3 p-4 rounded-xl mb-6 animate-fade-in ${
                                                adminActionMessage.type === 'success' 
                                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            }`}>
                                                {adminActionMessage.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                                                <p className="font-medium">{adminActionMessage.text}</p>
                                            </div>
                                        )}

                                        {/* Tab Content */}
                                        {activeTab === 'info' && (
                                            <div className="space-y-8">
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                    {/* Personal Information */}
                                                    <div className="space-y-6">
                                                        <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                                                            <User className="h-6 w-6 text-blue-400" />
                                                            <span>Personal Information</span>
                                                        </h3>
                                                        
                                                        <div className="space-y-4">
                                                            <div className="glass-morphism-dark rounded-xl p-4 border border-white/10">
                                                                <div className="flex items-center space-x-3 mb-2">
                                                                    <User className="h-5 w-5 text-blue-400" />
                                                                    <p className="text-gray-400 text-sm font-medium">Username</p>
                                                                </div>
                                                                <p className="text-white font-semibold text-lg">{selectedUser.username}</p>
                                                            </div>
                                                            
                                                            {selectedUser.name && canSeeFullInfo && (
                                                                <div className="glass-morphism-dark rounded-xl p-4 border border-white/10">
                                                                    <div className="flex items-center space-x-3 mb-2">
                                                                        <User className="h-5 w-5 text-green-400" />
                                                                        <p className="text-gray-400 text-sm font-medium">Full Name</p>
                                                                    </div>
                                                                    <p className="text-white font-semibold">{selectedUser.name}</p>
                                                                </div>
                                                            )}
                                                            
                                                            {selectedUser.email && canSeeFullInfo && (
                                                                <div className="glass-morphism-dark rounded-xl p-4 border border-white/10">
                                                                    <div className="flex items-center space-x-3 mb-2">
                                                                        <Mail className="h-5 w-5 text-purple-400" />
                                                                        <p className="text-gray-400 text-sm font-medium">Email</p>
                                                                    </div>
                                                                    <p className="text-white font-semibold">{selectedUser.email}</p>
                                                                </div>
                                                            )}

                                                            {selectedUser.nationality && (
                                                                <div className="glass-morphism-dark rounded-xl p-4 border border-white/10">
                                                                    <div className="flex items-center space-x-3 mb-2">
                                                                        <MapPin className="h-5 w-5 text-orange-400" />
                                                                        <p className="text-gray-400 text-sm font-medium">Nationality</p>
                                                                    </div>
                                                                    <p className="text-white font-semibold">{selectedUser.nationality}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Profile Settings */}
                                                    <div className="space-y-6">
                                                        <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                                                            <Settings className="h-6 w-6 text-purple-400" />
                                                            <span>Profile Settings</span>
                                                        </h3>
                                                        
                                                        <div className="space-y-4">
                                                            <div className="glass-morphism-dark rounded-xl p-4 border border-white/10">
                                                                <div className="flex items-center space-x-3 mb-2">
                                                                    {selectedUser.is_profile_public ? <Eye className="h-5 w-5 text-green-400" /> : <EyeOff className="h-5 w-5 text-gray-400" />}
                                                                    <p className="text-gray-400 text-sm font-medium">Profile Visibility</p>
                                                                </div>
                                                                <p className={`font-semibold ${selectedUser.is_profile_public ? 'text-green-400' : 'text-gray-400'}`}>
                                                                    {selectedUser.is_profile_public ? 'Public' : 'Private'}
                                                                </p>
                                                            </div>

                                                            <div className="glass-morphism-dark rounded-xl p-4 border border-white/10">
                                                                <div className="flex items-center space-x-3 mb-2">
                                                                    <Crown className="h-5 w-5 text-yellow-400" />
                                                                    <p className="text-gray-400 text-sm font-medium">User Group</p>
                                                                </div>
                                                                <div className={`inline-flex items-center space-x-2 bg-gradient-to-r ${getGroupColor(selectedUser.group)} px-3 py-1 rounded-full`}>
                                                                    <Crown className="h-4 w-4 text-white" />
                                                                    <span className="text-white font-medium">{selectedUser.group}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Bio Section */}
                                                {selectedUser.bio && (
                                                    <div>
                                                        <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
                                                            <MessageSquare className="h-6 w-6 text-green-400" />
                                                            <span>Bio</span>
                                                        </h3>
                                                        <div className="glass-morphism-dark rounded-xl p-6 border border-white/10">
                                                            <p className="text-gray-200 leading-relaxed text-lg">{selectedUser.bio}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Moderation Tab */}
                                        {activeTab === 'moderation' && canBan && (
                                            <div className="space-y-8">
                                                <div className="text-center mb-8">
                                                    <h3 className="text-2xl font-bold text-red-400 mb-2">User Moderation</h3>
                                                    <p className="text-gray-300">Manage user bans and restrictions</p>
                                                </div>

                                                <div className="max-w-2xl mx-auto space-y-6">
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-300 mb-3">Ban Reason</label>
                                                        <textarea
                                                            value={banReason}
                                                            onChange={(e) => setBanReason(e.target.value)}
                                                            rows={4}
                                                            className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-4 text-white placeholder-gray-400 focus:outline-none focus:border-red-400 resize-none"
                                                            placeholder="Specify the reason for this moderation action..."
                                                        />
                                                    </div>
                                                    
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-300 mb-3">Ban Duration (Optional)</label>
                                                        <div className="relative">
                                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                                            <input
                                                                type="datetime-local"
                                                                value={bannedUntil}
                                                                onChange={(e) => setBannedUntil(e.target.value)}
                                                                className="w-full bg-white/5 border border-white/20 rounded-xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-red-400"
                                                            />
                                                        </div>
                                                        <p className="text-gray-400 text-sm mt-2">Leave empty for permanent ban</p>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                                                        <button
                                                            onClick={() => handleBanUser(false)}
                                                            disabled={adminActionLoading}
                                                            className="bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 hover:from-red-600 hover:to-orange-600 transition-all duration-300"
                                                        >
                                                            {adminActionLoading ? <Loader className="h-5 w-5 animate-spin" /> : <Ban className="h-5 w-5" />}
                                                            <span>{bannedUntil ? 'Temporary Ban' : 'Permanent Ban'}</span>
                                                        </button>
                                                        
                                                        <button
                                                            onClick={handleUnbanUser}
                                                            disabled={adminActionLoading}
                                                            className="glass-morphism-dark text-white font-bold py-4 px-6 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 hover:bg-white/20 transition-all duration-300 border border-white/20"
                                                        >
                                                            {adminActionLoading ? <Loader className="h-5 w-5 animate-spin" /> : <UserCheck className="h-5 w-5 text-green-400" />}
                                                            <span>Remove Ban</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Permissions Tab */}
                                        {activeTab === 'permissions' && canChangeGroup && (
                                            <div className="space-y-8">
                                                <div className="text-center mb-8">
                                                    <h3 className="text-2xl font-bold text-purple-400 mb-2">Group Management</h3>
                                                    <p className="text-gray-300">Assign user roles and permissions</p>
                                                </div>

                                                <div className="max-w-2xl mx-auto space-y-6">
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-300 mb-3">Current Group</label>
                                                        <div className={`inline-flex items-center space-x-3 bg-gradient-to-r ${getGroupColor(selectedUser.group)} px-6 py-4 rounded-xl shadow-lg`}>
                                                            <Crown className="h-6 w-6 text-white" />
                                                            <span className="text-white font-bold text-lg">{selectedUser.group}</span>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-300 mb-3">Assign New Group</label>
                                                        <div className="relative">
                                                            <select
                                                                value={newGroup}
                                                                onChange={(e) => setNewGroup(e.target.value)}
                                                                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-purple-400 appearance-none pr-10"
                                                            >
                                                                {ALL_GROUPS.map(group => (
                                                                    <option key={group} value={group} className="bg-gray-800">{group}</option>
                                                                ))}
                                                            </select>
                                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                                                                <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <button
                                                        onClick={handleUpdateGroup}
                                                        disabled={adminActionLoading || newGroup === selectedUser.group}
                                                        className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 hover:from-purple-600 hover:to-indigo-600 transition-all duration-300"
                                                    >
                                                        {adminActionLoading ? <Loader className="h-5 w-5 animate-spin" /> : <Users className="h-5 w-5" />}
                                                        <span>Update Group</span>
                                                    </button>

                                                    {/* Group Permissions Info */}
                                                    <div className="glass-morphism-dark rounded-xl p-6 border border-white/10">
                                                        <h4 className="text-white font-bold mb-4">Group Permissions</h4>
                                                        <div className="space-y-2 text-sm">
                                                            <div className="flex items-center space-x-2">
                                                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                                                <span className="text-gray-300">Basic Plan: Standard user access</span>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                                                <span className="text-gray-300">Premium Plan: Enhanced features</span>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                                                                <span className="text-gray-300">Support: Basic moderation tools</span>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                                                <span className="text-gray-300">Admin: Full platform control</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <Footer />
        </div>
    );
};

export default AdminPanelPage;