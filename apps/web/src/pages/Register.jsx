import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import { useDarkMode } from '../context/ThemeContext';

export default function Register() {
    const { darkMode } = useDarkMode();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        legalName: '',
        tradeName: '',
        gstin: '',
        email: '',
        password: '',
        phone: '',
        address: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Basic GSTIN Validation (15 chars)
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstinRegex.test(formData.gstin)) {
            alert('Invalid GSTIN format. Example: 29ABCDE1234F1Z5');
            setLoading(false);
            return;
        }

        try {
            await authService.register(formData);
            alert('Registration successful! Please login now.');
            navigate('/login');
        } catch (error) {
            console.error('Registration error:', error);

            let errorMessage = 'Registration failed. Please check your connection or try again.';

            if (error.response) {
                // Server responded with a status code outside 2xx
                const data = error.response.data;
                if (data && (data.message || data.error)) {
                    errorMessage = data.message || data.error;
                } else {
                    errorMessage = `Server Error (${error.response.status})`;
                }
            } else if (error.request) {
                // Request was made but no response received
                errorMessage = 'Network Error: Cannot reach the server. Please check if the backend is running.';
            } else {
                // Something happened in setting up the request
                errorMessage = error.message;
            }

            alert(errorMessage);
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h1 className={`text-4xl font-extrabold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'} mb-2`}>
                        InvoChain
                    </h1>
                    <h2 className={`text-xl font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                        Register your Business
                    </h2>
                    <p className={`mt-2 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Join the future of invoice management
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="legalName" className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'} mb-1`}>Legal Name</label>
                            <input
                                id="legalName"
                                name="legalName"
                                type="text"
                                required
                                className={`appearance-none block w-full px-3 py-2.5 border ${darkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-gray-300 text-gray-900'} rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all`}
                                placeholder="e.g. Acme Corp Private Limited"
                                value={formData.legalName}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="tradeName" className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'} mb-1`}>Trade Name</label>
                            <input
                                id="tradeName"
                                name="tradeName"
                                type="text"
                                required
                                className={`appearance-none block w-full px-3 py-2.5 border ${darkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-gray-300 text-gray-900'} rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all`}
                                placeholder="e.g. Acme Solutions"
                                value={formData.tradeName}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="gstin" className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'} mb-1`}>GSTIN</label>
                            <input
                                id="gstin"
                                name="gstin"
                                type="text"
                                required
                                className={`appearance-none block w-full px-3 py-2.5 border ${darkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-gray-300 text-gray-900'} rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all`}
                                placeholder="e.g. 29ABCDE1234F1Z5"
                                value={formData.gstin}
                                onChange={handleChange}
                            />
                        </div>
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
                            <label htmlFor="phone" className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'} mb-1`}>Phone Number</label>
                            <input
                                id="phone"
                                name="phone"
                                type="tel"
                                required
                                className={`appearance-none block w-full px-3 py-2.5 border ${darkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-gray-300 text-gray-900'} rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all`}
                                placeholder="+91 98765 43210"
                                value={formData.phone}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="address" className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'} mb-1`}>Address</label>
                            <input
                                id="address"
                                name="address"
                                type="text"
                                required
                                className={`appearance-none block w-full px-3 py-2.5 border ${darkMode ? 'border-slate-700 bg-slate-800 text-white' : 'border-gray-300 text-gray-900'} rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all`}
                                placeholder="Business Address"
                                value={formData.address}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className={`block text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'} mb-1`}>Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
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
                            {loading ? 'Creating Account...' : 'Register'}
                        </button>
                    </div>

                    <div className="text-center mt-4">
                        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            Already have an account?{' '}
                            <Link to="/login" className={`font-medium ${darkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'}`}>
                                Sign in
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
