import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/ThemeContext';

export default function Login() {
    const { darkMode } = useDarkMode();
    const { setUser } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await authService.login(formData);
            // Store token and user info
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));

            // Update app state
            setUser(response.data.user);

            alert('Login successful!');
            navigate('/');
        } catch (error) {
            console.error('Login error:', error);
            alert(error.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 ${darkMode ? 'bg-slate-950' : 'bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50'}`}>
            <div className={`max-w-md w-full space-y-8 ${darkMode ? 'bg-slate-900' : 'bg-white'} p-10 rounded-2xl shadow-xl border ${darkMode ? 'border-slate-800' : 'border-white/50'}`}>
                <div className="text-center">
                    <div className={`mx-auto h-16 w-16 ${darkMode ? 'bg-indigo-500/20' : 'bg-indigo-100'} rounded-2xl flex items-center justify-center mb-6`}>
                        <svg className={`h-10 w-10 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                    </div>
                    <h1 className={`text-4xl font-extrabold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'} mb-2`}>
                        InvoChain
                    </h1>
                    <h2 className={`text-xl font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                        Welcome Back
                    </h2>
                    <p className={`mt-2 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Sign in to manage your invoices
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="email" className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'} mb-1`}>Email Address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className={`appearance-none block w-full px-3 py-2.5 border ${darkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-gray-300 text-gray-900'} rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all`}
                                placeholder="name@company.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'} mb-1`}>Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className={`appearance-none block w-full px-3 py-2.5 border ${darkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-gray-300 text-gray-900'} rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all`}
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all transform hover:scale-[1.02]`}
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </div>

                    <div className="text-center mt-4">
                        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            Don't have an account?{' '}
                            <Link to="/register" className={`font-medium ${darkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'}`}>
                                Register now
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
