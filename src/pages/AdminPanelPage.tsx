import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Search, Ban, UserCheck, Users, Loader, AlertCircle, CheckCircle, Eye, EyeOff, XCircle, Clock, MessageSquare, Mail, Globe, Image, Crown } from 'lucide-react';
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

// Define the groups for dropdowns (should match backend's User::GROUP_HIERARCHY keys)
const ALL_GROUPS = ['Basic Plan', 'Premium Plan', 'Junior Support', 'Support', 'Senior Support', 'Admin', 'Owner'];

interface UserProfileData {
    id: number;
    username: string;
    name?: string; // Only if viewer has privilege or is owner
    email?: string; // Only if viewer has privilege or is owner
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

    // Admin action states
    const [banReason, setBanReason] = useState('');
    const [bannedUntil, setBannedUntil] = useState(''); // ISO date string for temporary ban
    const [newGroup, setNewGroup] = useState('');
    const [adminActionLoading, setAdminActionLoading] = useState(false);
    const [adminActionMessage, setAdminActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Authorization checks
    const canAccessPanel = hasPrivilege(['Junior Support', 'Support', 'Senior Support', 'Admin', 'Owner']);
    const canBan = hasPrivilege(['Admin', 'Owner', 'Senior Support']);
    const canChangeGroup = hasPrivilege(['Admin', 'Owner']);
    const canSeeFullInfo = hasPrivilege(['Admin', 'Owner', 'Senior Support']); // Same as ban privilege for full info

    // Redirect if not authorized
    useEffect(() => {
        if (!authLoading && !canAccessPanel) {
            navigate('/'); // Redirect non-authorized users
        }
    }, [authLoading, canAccessPanel, navigate]);

    // Handle user search
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setSearchLoading(true);
        setSearchResults([]);
        setSearchError(null);
        setSelectedUser(null); // Clear selected user on new search

        if (!searchQuery.trim()) {
            setSearchError('Please enter a user ID or username to search.');
            setSearchLoading(false);
            return;
        }

        try {
            // Attempt to search by ID first, then by username
            let userFound = false;
            let response;
            try {
                response = await apiClient.get(`/users/${searchQuery.trim()}/profile`);
                userFound = true;
            } catch (idErr: any) {
                // If not found by ID, try searching by username (if search query is not purely numeric)
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
        setBanReason(user.ban_reason || '');
        setBannedUntil(user.banned_until ? new Date(user.banned_until).toISOString().slice(0, 16) : ''); // Format for datetime-local
        setNewGroup(user.group);
        setAdminActionMessage(null); // Clear previous messages
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedUser(null);
        setAdminActionMessage(null);
    };

    // Admin Action Handlers (copied/adapted from EditProfilePage for consistency)
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
            // Update selected user's ban status in state
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
            // Update selected user's ban status in state
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
            // Update selected user's group in state
            setSelectedUser(prev => prev ? { ...prev, group: newGroup } : null);
        } catch (error: any) {
            console.error('Failed to update group:', error);
            const errorMessage = error.response?.data?.message || 'Failed to update group. Check privileges or user ID.';
            setAdminActionMessage({ type: 'error', text: errorMessage });
        } finally {
            setAdminActionLoading(false);
        }
    };

    if (authLoading || !canAccessPanel) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <Loader className="h-12 w-12 text-white animate-spin" />
                <p className="text-white ml-4">Loading admin panel...</p>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden">
            <ParticleNetwork />
            <Navbar />
            
            <div className="pt-20 pb-16">
                {/* Page Header */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
                        Admin
                        <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> Panel</span>
                    </h1>
                    <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                        Manage users, groups, and moderation actions.
                    </p>
                </div>

                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="glass-morphism rounded-3xl p-8 border border-white/20 shadow-2xl space-y-8 animate-fade-in">
                        {/* User Search Section */}
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-white mb-4">Search Users</h2>
                            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-white/5 border border-white/20 rounded-xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                                        placeholder="Search by User ID or Username"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={searchLoading}
                                    className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 hover:from-blue-600 hover:to-cyan-600 transition-all duration-300"
                                >
                                    {searchLoading ? <Loader className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                                    <span>Search</span>
                                </button>
                            </form>
                            {searchError && (
                                <div className="text-red-400 text-sm mt-4 flex items-center space-x-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>{searchError}</span>
                                </div>
                            )}
                        </div>

                        {/* Search Results */}
                        {searchResults.length > 0 && (
                            <div className="border-t border-white/10 pt-8">
                                <h2 className="text-2xl font-bold text-white mb-4">Search Results</h2>
                                <div className="space-y-4">
                                    {searchResults.map(user => (
                                        <div key={user.id} className="bg-white/5 border border-white/20 rounded-xl p-4 flex items-center justify-between">
                                            <div className="flex items-center space-x-4">
                                                <img
                                                    src={user.profile_picture_url || 'https://placehold.co/48x48/000000/FFFFFF?text=U'}
                                                    alt={user.username}
                                                    className="w-12 h-12 rounded-full object-cover border border-white/20"
                                                    onError={(e) => { e.currentTarget.src = 'https://placehold.co/48x48/000000/FFFFFF?text=U'; }}
                                                />
                                                <div>
                                                    <p className="text-white font-semibold">{user.username}</p>
                                                    <p className="text-gray-400 text-sm">ID: {user.id} | Group: {user.group}</p>
                                                    {user.banned_until && new Date(user.banned_until) > new Date() && (
                                                        <p className="text-red-400 text-xs flex items-center space-x-1">
                                                            <Ban className="h-3 w-3" /> <span>Banned</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleViewUserDetails(user)}
                                                className="bg-indigo-500/20 text-indigo-400 px-4 py-2 rounded-lg font-medium hover:bg-indigo-500/30 transition-colors duration-200"
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* User Details Modal */}
                        {modalOpen && selectedUser && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg">
                                <div className="bg-white/10 rounded-3xl border border-white/20 p-8 max-w-2xl w-full shadow-2xl animate-fade-in relative">
                                    <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10"><XCircle className="h-6 w-6" /></button>
                                    <h2 className="text-3xl font-bold text-white mb-6 text-center">User Details: {selectedUser.username}</h2>
                                    
                                    <div className="flex flex-col items-center mb-6">
                                        <img
                                            src={selectedUser.profile_picture_url || 'https://placehold.co/128x128/000000/FFFFFF?text=User'}
                                            alt={selectedUser.username}
                                            className="w-24 h-24 rounded-full object-cover mb-4 border-4 border-white/30 shadow-lg"
                                            onError={(e) => { e.currentTarget.src = 'https://placehold.co/128x128/000000/FFFFFF?text=User'; }}
                                        />
                                        <p className="text-white text-xl font-semibold mb-2">{selectedUser.username}</p>
                                        <p className="text-gray-400 text-md flex items-center space-x-2">
                                            <Crown className="h-4 w-4 text-yellow-400" />
                                            <span>{selectedUser.group}</span>
                                        </p>
                                    </div>

                                    {selectedUser.banned_until && new Date(selectedUser.banned_until) > new Date() && (
                                        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center space-x-3">
                                            <Ban className="h-6 w-6 text-red-400" />
                                            <div>
                                                <h3 className="text-red-400 font-bold">This user is currently banned!</h3>
                                                <p className="text-red-300 text-sm">Reason: {selectedUser.ban_reason}</p>
                                                <p className="text-red-300 text-xs">Until: {new Date(selectedUser.banned_until).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mb-6">
                                        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                            <p className="text-gray-400 text-sm">User ID:</p>
                                            <p className="text-white font-medium">{selectedUser.id}</p>
                                        </div>
                                        {selectedUser.name && canSeeFullInfo && (
                                            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                                <p className="text-gray-400 text-sm">Full Name:</p>
                                                <p className="text-white font-medium">{selectedUser.name}</p>
                                            </div>
                                        )}
                                        {selectedUser.email && canSeeFullInfo && (
                                            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                                <p className="text-gray-400 text-sm">Email:</p>
                                                <p className="text-white font-medium">{selectedUser.email}</p>
                                            </div>
                                        )}
                                        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                            <p className="text-gray-400 text-sm">Profile Public:</p>
                                            <p className="text-white font-medium">{selectedUser.is_profile_public ? 'Yes' : 'No'}</p>
                                        </div>
                                        {selectedUser.nationality && (
                                            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                                <p className="text-gray-400 text-sm">Nationality:</p>
                                                <p className="text-white font-medium">{selectedUser.nationality}</p>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {selectedUser.bio && (
                                        <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-6">
                                            <p className="text-gray-400 text-sm">Bio:</p>
                                            <p className="text-white font-medium">{selectedUser.bio}</p>
                                        </div>
                                    )}

                                    {/* Admin Actions within Modal */}
                                    {(canBan || canChangeGroup) && (
                                        <div className="border-t border-white/10 pt-6 mt-6 space-y-6">
                                            <h3 className="text-xl font-bold text-white mb-4">Actions for {selectedUser.username}</h3>
                                            {adminActionMessage && (
                                                <div className={`flex items-center space-x-2 p-3 rounded-lg ${adminActionMessage.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                                    {adminActionMessage.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                                                    <p className="text-sm">{adminActionMessage.text}</p>
                                                </div>
                                            )}

                                            {/* Ban/Unban Section */}
                                            {canBan && (
                                                <div className="space-y-4">
                                                    <div>
                                                        <label htmlFor="banReasonModal" className="block text-sm font-bold text-gray-300 mb-2">Ban Reason</label>
                                                        <textarea
                                                            id="banReasonModal"
                                                            name="banReasonModal"
                                                            value={banReason}
                                                            onChange={(e) => setBanReason(e.target.value)}
                                                            rows={2}
                                                            className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-red-400 resize-y"
                                                            placeholder="Reason for banning"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label htmlFor="bannedUntilModal" className="block text-sm font-bold text-gray-300 mb-2">Banned Until (Optional)</label>
                                                        <input
                                                            type="datetime-local"
                                                            id="bannedUntilModal"
                                                            name="bannedUntilModal"
                                                            value={bannedUntil}
                                                            onChange={(e) => setBannedUntil(e.target.value)}
                                                            className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-400"
                                                        />
                                                        <p className="text-gray-400 text-xs mt-1">Leave empty for permanent ban.</p>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row gap-4">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleBanUser(false)}
                                                            disabled={adminActionLoading}
                                                            className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 hover:from-red-600 hover:to-orange-600 transition-all duration-300"
                                                        >
                                                            {adminActionLoading ? <Loader className="h-5 w-5 animate-spin" /> : <Ban className="h-5 w-5" />}
                                                            <span>{bannedUntil ? 'Temporarily Ban' : 'Permanent Ban'}</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleUnbanUser}
                                                            disabled={adminActionLoading}
                                                            className="flex-1 bg-white/10 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 hover:bg-white/20 transition-all duration-300 border border-white/20"
                                                        >
                                                            {adminActionLoading ? <Loader className="h-5 w-5 animate-spin" /> : <UserCheck className="h-5 w-5 text-green-400" />}
                                                            <span>Unban User</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Change Group Section */}
                                            {canChangeGroup && (
                                                <div className="border-t border-white/10 pt-6 mt-6 space-y-4">
                                                    <div>
                                                        <label htmlFor="newGroupModal" className="block text-sm font-bold text-gray-300 mb-2">New Group</label>
                                                        <div className="relative">
                                                            <select
                                                                id="newGroupModal"
                                                                name="newGroupModal"
                                                                value={newGroup}
                                                                onChange={(e) => setNewGroup(e.target.value)}
                                                                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-400 appearance-none pr-10"
                                                            >
                                                                {ALL_GROUPS.map(group => (
                                                                    <option key={group} value={group}>{group}</option>
                                                                ))}
                                                            </select>
                                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleUpdateGroup}
                                                        disabled={adminActionLoading}
                                                        className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center space-x-2 hover:from-purple-600 hover:to-indigo-600 transition-all duration-300"
                                                    >
                                                        {adminActionLoading ? <Loader className="h-5 w-5 animate-spin" /> : <Users className="h-5 w-5" />}
                                                        <span>Update Group</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
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
