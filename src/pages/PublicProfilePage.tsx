import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { User, Globe, Image, Lock, Loader, AlertCircle, Ban, MessageSquare, Mail } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ParticleNetwork from '../components/ParticleNetwork';
import { useAuth } from '../context/AuthContext'; // Import useAuth to check viewer's privileges
import axios from 'axios';

const apiClient = axios.create({
    baseURL: 'https://api.cpp-hub.com/api',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
});

// Optional: If you want to send auth token even for public profile requests
// This is important if you want the backend to know the viewer's group
apiClient.interceptors.request.use(config => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

interface PublicProfileData {
    id: number;
    username: string | null; // Now expecting username
    name?: string; // Optional, only if viewer has privilege or is owner
    email?: string; // Optional, only if viewer has privilege or is owner
    bio: string | null;
    nationality: string | null;
    profile_picture_url: string | null;
    is_profile_public: boolean;
    group: string; // Group is always public
    banned_until?: string | null; // Optional, if banned
    ban_reason?: string | null; // Optional, if banned
    is_private?: boolean; // For backend response
    message?: string; // For backend response messages
}

const PublicProfilePage: React.FC = () => {
    const { id } = useParams<{ id: string }>(); // Get user ID or username from URL params
    const { user: currentUser, hasPrivilege } = useAuth(); // Get current authenticated user and privilege checker
    const [profile, setProfile] = useState<PublicProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isTargetUserBanned, setIsTargetUserBanned] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            setError(null);
            setIsTargetUserBanned(false);
            try {
                // Fetch public profile using the user ID or username
                const response = await apiClient.get(`/users/${id}/profile`);
                setProfile(response.data);
                if (response.data.banned_until) {
                    const bannedUntilDate = new Date(response.data.banned_until);
                    if (bannedUntilDate > new Date()) {
                        setIsTargetUserBanned(true);
                    }
                }
            } catch (err: any) {
                console.error('Failed to fetch public profile:', err);
                if (err.response?.status === 403) {
                    if (err.response?.data?.is_private) {
                        setError('This profile is private.');
                    } else if (err.response?.data?.message && err.response?.data?.banned_until) {
                        // User is banned
                        setIsTargetUserBanned(true);
                        setProfile({
                            id: 0, // Placeholder ID
                            username: id, // Use ID from params as username placeholder
                            bio: null, nationality: null, profile_picture_url: null, is_profile_public: false, group: 'Unknown',
                            banned_until: err.response.data.banned_until,
                            ban_reason: err.response.data.ban_reason,
                            message: err.response.data.message
                        });
                        setError(null); // Clear other errors
                    } else {
                        setError('Access Denied.');
                    }
                } else if (err.response?.status === 404) {
                    setError('User not found.');
                } else {
                    setError('Failed to load profile. Please try again later.');
                }
                setProfile(null); // Clear profile data on error unless it's a ban message
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchProfile();
        }
    }, [id, currentUser]); // Re-fetch if current user changes (for privilege checks)

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
                <Loader className="h-12 w-12 text-white animate-spin" />
                <p className="text-white ml-4">Loading profile...</p>
            </div>
        );
    }

    // Determine if the current viewer is the owner of this profile
    const isOwner = currentUser && profile && currentUser.id === profile.id;
    // Determine if the current viewer has privilege to see full info
    const canSeeFullInfo = hasPrivilege(['Admin', 'Owner', 'Senior Support']);

    return (
        <div className="relative min-h-screen overflow-hidden">
            <ParticleNetwork />
            <Navbar />
            
            <div className="pt-20 pb-16">
                {/* Page Header */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
                        User
                        <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"> Profile</span>
                    </h1>
                    <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                        Discover more about this C++ Hub member.
                    </p>
                </div>

                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="glass-morphism rounded-3xl p-8 border border-white/20 shadow-2xl text-center animate-fade-in">
                        {error ? (
                            <div className="text-red-400 flex flex-col items-center justify-center space-y-4">
                                <AlertCircle className="h-16 w-16" />
                                <p className="text-xl font-semibold">{error}</p>
                                {isTargetUserBanned && profile && ( // Show ban details if it's a ban error
                                    <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mt-4 w-full">
                                        <h3 className="text-red-400 font-bold flex items-center justify-center space-x-2">
                                            <Ban className="h-5 w-5" /> <span>This user is banned!</span>
                                        </h3>
                                        <p className="text-red-300 text-sm mt-2">Reason: {profile.ban_reason}</p>
                                        <p className="text-red-300 text-xs">Until: {profile.banned_until ? new Date(profile.banned_until).toLocaleString() : 'Permanent'}</p>
                                    </div>
                                )}
                            </div>
                        ) : profile ? (
                            <>
                                <img
                                    src={profile.profile_picture_url || 'https://placehold.co/128x128/000000/FFFFFF?text=User'}
                                    alt={profile.username || 'User'}
                                    className="w-32 h-32 rounded-full object-cover mx-auto mb-6 border-4 border-white/30 shadow-lg"
                                    onError={(e) => { e.currentTarget.src = 'https://placehold.co/128x128/000000/FFFFFF?text=User'; }}
                                />
                                <h2 className="text-3xl font-bold text-white mb-2">
                                    {profile.username || 'No Username'}
                                </h2>
                                <p className="text-gray-400 text-sm mb-4">Group: {profile.group}</p>

                                {/* Conditionally display full name and email */}
                                {(profile.name && (isOwner || canSeeFullInfo)) && (
                                    <p className="text-gray-300 text-lg flex items-center justify-center space-x-2 mb-2">
                                        <User className="h-5 w-5 text-indigo-400" />
                                        <span>{profile.name}</span>
                                    </p>
                                )}
                                {(profile.email && (isOwner || canSeeFullInfo)) && (
                                    <p className="text-gray-300 text-lg flex items-center justify-center space-x-2 mb-4">
                                        <Mail className="h-5 w-5 text-indigo-400" />
                                        <span>{profile.email}</span>
                                    </p>
                                )}

                                {profile.nationality && (
                                    <p className="text-gray-300 text-lg flex items-center justify-center space-x-2 mb-4">
                                        <Globe className="h-5 w-5 text-indigo-400" />
                                        <span>{profile.nationality}</span>
                                    </p>
                                )}
                                {profile.bio && (
                                    <p className="text-gray-300 leading-relaxed mb-6">
                                        {profile.bio}
                                    </p>
                                )}
                                {!profile.bio && !profile.nationality && (
                                    <p className="text-gray-400 text-sm mb-6">
                                        No public bio or nationality available.
                                    </p>
                                )}
                                
                                {/* Ban Status Display */}
                                {isTargetUserBanned && (
                                    <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mt-4">
                                        <h3 className="text-red-400 font-bold flex items-center justify-center space-x-2">
                                            <Ban className="h-5 w-5" /> <span>This user is banned!</span>
                                        </h3>
                                        <p className="text-red-300 text-sm mt-2">Reason: {profile.ban_reason}</p>
                                        <p className="text-red-300 text-xs">Until: {profile.banned_until ? new Date(profile.banned_until).toLocaleString() : 'Permanent'}</p>
                                    </div>
                                )}

                                {/* Link to edit profile if it's the current user's profile */}
                                {isOwner && (
                                    <Link 
                                        to="/profile/edit" 
                                        className="mt-6 inline-flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-600 hover:to-cyan-600 transition-all duration-200"
                                    >
                                        <User className="h-5 w-5" />
                                        <span>Edit Your Profile</span>
                                    </Link>
                                )}
                            </>
                        ) : (
                            <div className="text-gray-400 flex flex-col items-center justify-center space-y-4">
                                <AlertCircle className="h-16 w-16" />
                                <p className="text-xl font-semibold">Profile not found or inaccessible.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <Footer />
        </div>
    );
};

export default PublicProfilePage;
