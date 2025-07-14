import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Globe, Image, Save, Loader, AlertCircle, CheckCircle, Trash2, Ban, UserCheck, Users, Calendar, MessageSquare } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ParticleNetwork from '../components/ParticleNetwork';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const apiClient = axios.create({
    baseURL: 'https://api.cpp-hub.com/api',
    headers: {
        // 'Accept': 'application/json', // Default, will be overridden by FormData for file upload
    }
});

apiClient.interceptors.request.use(config => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

const EditProfilePage: React.FC = () => {
    const { user, isLoading: authLoading, updateUser, hasPrivilege, isBanned } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: user?.name || '',
        username: user?.username || '', // Add username to form data
        bio: user?.bio || '',
        nationality: user?.nationality || '',
        is_profile_public: user?.is_profile_public ?? false,
    });
    const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
    const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(user?.profile_picture_url || null);
    const [clearProfilePicture, setClearProfilePicture] = useState(false);

    // State for admin actions
    const [targetUserId, setTargetUserId] = useState(''); // For banning/group changes
    const [banReason, setBanReason] = useState('');
    const [bannedUntil, setBannedUntil] = useState(''); // ISO date string for temporary ban
    const [newGroup, setNewGroup] = useState('');
    const [adminActionLoading, setAdminActionLoading] = useState(false);
    const [adminActionMessage, setAdminActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);


    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Define all possible groups for the dropdown
    const allGroups = ['Basic Plan', 'Premium Plan', 'Junior Support', 'Support', 'Senior Support', 'Admin', 'Owner'];

    // Redirect if not logged in or user data not loaded
    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/'); // Redirect to home or login if not authenticated
        } else if (user) {
            // Populate form data once user is loaded
            setFormData({
                name: user.name,
                username: user.username || '',
                bio: user.bio || '',
                nationality: user.nationality || '',
                is_profile_public: user.is_profile_public,
            });
            setProfilePicturePreview(user.profile_picture_url || null);
            // Set initial group for admin dropdown if user is admin
            if (hasPrivilege(['Admin', 'Owner'])) {
                setNewGroup(user.group);
            }
        }
    }, [user, authLoading, navigate, hasPrivilege]);

    // Handle file selection for profile picture
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setProfilePictureFile(file);
            setProfilePicturePreview(URL.createObjectURL(file)); // Create a preview URL
            setClearProfilePicture(false); // If a new file is selected, don't clear
        } else {
            setProfilePictureFile(null);
            // Don't clear preview here, let user explicitly clear or select new
        }
    };

    // Handle clearing profile picture
    const handleClearProfilePicture = () => {
        setProfilePictureFile(null);
        setProfilePicturePreview(null);
        setClearProfilePicture(true); // Signal to backend to clear
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type, checked } = e.target as HTMLInputElement;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        const dataToSend = new FormData();
        dataToSend.append('_method', 'PUT'); // Laravel expects PUT for update with FormData

        // Append text fields
        dataToSend.append('name', formData.name);
        dataToSend.append('username', formData.username); // Include username
        dataToSend.append('bio', formData.bio);
        dataToSend.append('nationality', formData.nationality);
        // Convert boolean to string '1' or '0' for FormData
        dataToSend.append('is_profile_public', formData.is_profile_public ? '1' : '0');

        // Append profile picture file if selected
        if (profilePictureFile) {
            dataToSend.append('profile_picture', profilePictureFile);
        } else if (clearProfilePicture) {
            // Send '1' to signal clearing the picture
            dataToSend.append('clear_profile_picture', '1');
        }

        try {
            const response = await apiClient.post('/user/profile', dataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data', // Important for file uploads
                },
            });
            // Update user in AuthContext with the full user object from the response
            updateUser(response.data.user); 
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setClearProfilePicture(false); // Reset clear flag after successful update
            setProfilePictureFile(null); // Reset file input after successful upload
        } catch (error: any) {
            console.error('Failed to update profile:', error);
            const errorMessage = error.response?.data?.message || (error.response?.data?.errors ? Object.values(error.response.data.errors).flat().join(' ') : 'Failed to update profile. Please try again.');
            setMessage({ type: 'error', text: errorMessage });
        } finally {
            setLoading(false);
        }
    };

    // Admin Action Handlers
    const handleBanUser = async (permanent: boolean = false) => {
        if (!targetUserId || (!permanent && !bannedUntil) || !banReason) {
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
            await apiClient.post(`/admin/users/${targetUserId}/ban`, data);
            setAdminActionMessage({ type: 'success', text: `User ${targetUserId} banned successfully!` });
            setTargetUserId('');
            setBanReason('');
            setBannedUntil('');
        } catch (error: any) {
            console.error('Failed to ban user:', error);
            const errorMessage = error.response?.data?.message || 'Failed to ban user. Check privileges or user ID.';
            setAdminActionMessage({ type: 'error', text: errorMessage });
        } finally {
            setAdminActionLoading(false);
        }
    };

    const handleUnbanUser = async () => {
        if (!targetUserId) {
            setAdminActionMessage({ type: 'error', text: 'Please enter a User ID to unban.' });
            return;
        }
        setAdminActionLoading(true);
        setAdminActionMessage(null);
        try {
            await apiClient.post(`/admin/users/${targetUserId}/unban`);
            setAdminActionMessage({ type: 'success', text: `User ${targetUserId} unbanned successfully!` });
            setTargetUserId('');
        } catch (error: any) {
            console.error('Failed to unban user:', error);
            const errorMessage = error.response?.data?.message || 'Failed to unban user. Check privileges or user ID.';
            setAdminActionMessage({ type: 'error', text: errorMessage });
        } finally {
            setAdminActionLoading(false);
        }
    };

    const handleUpdateGroup = async () => {
        if (!targetUserId || !newGroup) {
            setAdminActionMessage({ type: 'error', text: 'Please enter User ID and select a new group.' });
            return;
        }
        setAdminActionLoading(true);
        setAdminActionMessage(null);
        try {
            await apiClient.post(`/admin/users/${targetUserId}/group`, { group: newGroup });
            setAdminActionMessage({ type: 'success', text: `User ${targetUserId} group updated to ${newGroup}!` });
            setTargetUserId('');
            setNewGroup(''); // Reset after successful update
        } catch (error: any) {
            console.error('Failed to update group:', error);
            const errorMessage = error.response?.data?.message || 'Failed to update group. Check privileges or user ID.';
            setAdminActionMessage({ type: 'error', text: errorMessage });
        } finally {
            setAdminActionLoading(false);
        }
    };

    const canBan = hasPrivilege(['Admin', 'Owner', 'Senior Support']);
    const canChangeGroup = hasPrivilege(['Admin', 'Owner']);

    if (authLoading || !user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <Loader className="h-12 w-12 text-white animate-spin" />
                <p className="text-white ml-4">Loading profile...</p>
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
                        Edit Your
                        <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> Profile</span>
                    </h1>
                    <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                        Manage your personal information and public visibility.
                    </p>
                </div>

                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* User's own profile form */}
                    <form onSubmit={handleSubmit} className="glass-morphism rounded-3xl p-8 border border-white/20 shadow-2xl space-y-6 animate-fade-in mb-12">
                        <h2 className="text-2xl font-bold text-white mb-4">Your Profile Information</h2>
                        {message && (
                            <div className={`flex items-center space-x-2 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                                <p className="text-sm">{message.text}</p>
                            </div>
                        )}

                        {/* Display User ID and Group */}
                        <div className="flex items-center justify-between bg-white/5 border border-white/20 rounded-xl p-4">
                            <div className="flex items-center space-x-3">
                                <User className="h-5 w-5 text-blue-400" />
                                <span className="text-gray-300 font-medium">User ID: <span className="text-white">{user.id}</span></span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <Users className="h-5 w-5 text-purple-400" />
                                <span className="text-gray-300 font-medium">Group: <span className="text-white">{user.group}</span></span>
                            </div>
                        </div>

                        {/* Ban Status Display */}
                        {isBanned() && (
                            <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3 animate-fade-in">
                                <Ban className="h-6 w-6 text-red-400" />
                                <div>
                                    <h3 className="text-red-400 font-bold">You are currently banned!</h3>
                                    <p className="text-red-300 text-sm">Reason: {user.ban_reason}</p>
                                    <p className="text-red-300 text-xs">Until: {user.banned_until ? new Date(user.banned_until).toLocaleString() : 'Permanent'}</p>
                                </div>
                            </div>
                        )}

                        {/* Full Name */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-bold text-gray-300 mb-2">Full Name</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-400" />
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="w-full bg-white/5 border border-white/20 rounded-xl pl-12 py-4 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                                    placeholder="Your full name"
                                    required
                                />
                            </div>
                        </div>

                        {/* Username */}
                        <div>
                            <label htmlFor="username" className="block text-sm font-bold text-gray-300 mb-2">Username</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-400" />
                                <input
                                    type="text"
                                    id="username"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    className="w-full bg-white/5 border border-white/20 rounded-xl pl-12 py-4 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                                    placeholder="Your unique username"
                                    required
                                />
                            </div>
                        </div>

                        {/* Bio */}
                        <div>
                            <label htmlFor="bio" className="block text-sm font-bold text-gray-300 mb-2">Bio</label>
                            <textarea
                                id="bio"
                                name="bio"
                                value={formData.bio}
                                onChange={handleInputChange}
                                rows={4}
                                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 resize-y"
                                placeholder="Tell us a little about yourself (max 1000 characters)"
                                maxLength={1000}
                            />
                        </div>

                        {/* Nationality */}
                        <div>
                            <label htmlFor="nationality" className="block text-sm font-bold text-gray-300 mb-2">Nationality</label>
                            <div className="relative group">
                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-400" />
                                <input
                                    type="text"
                                    id="nationality"
                                    name="nationality"
                                    value={formData.nationality}
                                    onChange={handleInputChange}
                                    className="w-full bg-white/5 border border-white/20 rounded-xl pl-12 py-4 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                                    placeholder="Your nationality"
                                />
                            </div>
                        </div>

                        {/* Profile Picture Upload */}
                        <div>
                            <label htmlFor="profile_picture" className="block text-sm font-bold text-gray-300 mb-2">Profile Picture</label>
                            <div className="flex items-center space-x-4">
                                <label htmlFor="profile_picture" className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 cursor-pointer flex items-center justify-center space-x-2 hover:bg-white/10 transition-colors duration-200">
                                    <Image className="h-5 w-5 text-gray-400" />
                                    <span>{profilePictureFile ? profilePictureFile.name : 'Choose File'}</span>
                                    <input
                                        type="file"
                                        id="profile_picture"
                                        name="profile_picture"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </label>
                                {(profilePicturePreview || user?.profile_picture_url) && ( // Show clear button if there's a preview or existing URL
                                    <button
                                        type="button"
                                        onClick={handleClearProfilePicture}
                                        className="p-3 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors duration-200"
                                        title="Remove Profile Picture"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                            {profilePicturePreview && (
                                <div className="mt-4 text-center">
                                    <img src={profilePicturePreview} alt="Profile Preview" className="w-24 h-24 rounded-full object-cover mx-auto border-2 border-white/20 shadow-lg" onError={(e) => { e.currentTarget.src = 'https://placehold.co/96x96/000000/FFFFFF?text=No+Image'; }} />
                                    <p className="text-gray-400 text-xs mt-2">Preview</p>
                                </div>
                            )}
                            {!profilePicturePreview && !user?.profile_picture_url && (
                                <p className="text-gray-400 text-xs mt-2">No profile picture selected.</p>
                            )}
                        </div>

                        {/* Public Profile Checkbox */}
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="is_profile_public"
                                name="is_profile_public"
                                checked={formData.is_profile_public}
                                onChange={handleInputChange}
                                className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 bg-white/10"
                            />
                            <label htmlFor="is_profile_public" className="ml-3 text-lg font-medium text-gray-300">
                                Make my profile public
                            </label>
                            <span className="ml-2 text-sm text-gray-400">(Other users can see your username, bio, nationality, and profile picture)</span>
                        </div>
                        <p className="text-sm text-gray-400 mt-2">Your full name and email address will always remain private to other users.</p>

                        {/* Save Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center space-x-3 text-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-300"
                        >
                            {loading ? (
                                <><Loader className="h-5 w-5 animate-spin" /><span>Saving...</span></>
                            ) : (
                                <><Save className="h-5 w-5" /><span>Save Profile</span></>
                            )}
                        </button>
                    </form>

                    {/* Admin/Moderation Tools */}
                    {(canBan || canChangeGroup) && (
                        <div className="glass-morphism rounded-3xl p-8 border border-white/20 shadow-2xl space-y-8 animate-fade-in">
                            <h2 className="text-2xl font-bold text-white mb-4">Admin/Moderation Tools</h2>
                            {adminActionMessage && (
                                <div className={`flex items-center space-x-2 p-3 rounded-lg ${adminActionMessage.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                    {adminActionMessage.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                                    <p className="text-sm">{adminActionMessage.text}</p>
                                </div>
                            )}

                            {/* Target User ID Input */}
                            <div>
                                <label htmlFor="targetUserId" className="block text-sm font-bold text-gray-300 mb-2">Target User ID (or Username for Public Profile)</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-400" />
                                    <input
                                        type="text"
                                        id="targetUserId"
                                        name="targetUserId"
                                        value={targetUserId}
                                        onChange={(e) => setTargetUserId(e.target.value)}
                                        className="w-full bg-white/5 border border-white/20 rounded-xl pl-12 py-4 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                                        placeholder="Enter User ID or Username"
                                    />
                                </div>
                            </div>

                            {/* Ban User Section */}
                            {canBan && (
                                <div className="border-t border-white/10 pt-6">
                                    <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center space-x-2">
                                        <Ban className="h-6 w-6" /> <span>Ban User</span>
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="banReason" className="block text-sm font-bold text-gray-300 mb-2">Ban Reason</label>
                                            <textarea
                                                id="banReason"
                                                name="banReason"
                                                value={banReason}
                                                onChange={(e) => setBanReason(e.target.value)}
                                                rows={3}
                                                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-red-400 resize-y"
                                                placeholder="Reason for banning (e.g., 'Spamming', 'Harassment')"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="bannedUntil" className="block text-sm font-bold text-gray-300 mb-2">Banned Until (Optional, for temporary ban)</label>
                                            <div className="relative group">
                                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-red-400" />
                                                <input
                                                    type="datetime-local"
                                                    id="bannedUntil"
                                                    name="bannedUntil"
                                                    value={bannedUntil}
                                                    onChange={(e) => setBannedUntil(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/20 rounded-xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-red-400"
                                                />
                                            </div>
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
                                </div>
                            )}

                            {/* Change Group Section */}
                            {canChangeGroup && (
                                <div className="border-t border-white/10 pt-6">
                                    <h3 className="text-xl font-bold text-purple-400 mb-4 flex items-center space-x-2">
                                        <Users className="h-6 w-6" /> <span>Change User Group</span>
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="newGroup" className="block text-sm font-bold text-gray-300 mb-2">New Group</label>
                                            <div className="relative">
                                                <select
                                                    id="newGroup"
                                                    name="newGroup"
                                                    value={newGroup}
                                                    onChange={(e) => setNewGroup(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-purple-400 appearance-none pr-10"
                                                >
                                                    <option value="" disabled>Select a group</option>
                                                    {allGroups.map(group => (
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
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            <Footer />
        </div>
    );
};

export default EditProfilePage;
