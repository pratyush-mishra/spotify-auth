import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import * as cheerio from 'cheerio';

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_CLIENT_ID;
const SPOTIFY_REDIRECT_URI = 'https://spotify-auth-six-lime.vercel.app/';
const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

function App() {
    const [accessToken, setAccessToken] = useState(null);
    const [likedSongs, setLikedSongs] = useState([]);
    const [currentSong, setCurrentSong] = useState(null);
    const [userGuess, setUserGuess] = useState('');
    const [guessResult, setGuessResult] = useState('');
    const [guessStatus, setGuessStatus] = useState(''); // 'correct' or 'incorrect'
    const [correctGuesses, setCorrectGuesses] = useState(0);
    const [incorrectGuesses, setIncorrectGuesses] = useState(0);
    const [authStatus, setAuthStatus] = useState('Not Authenticated');
    const [showSpotifyAuth, setShowSpotifyAuth] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // New state for username and password
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // useRef to store the audio element
    const audioRef = useRef(null);

    useEffect(() => {
        const hash = window.location.hash;
        let token = window.localStorage.getItem('spotify_access_token');

        if (!token && hash) {
            token = hash.substring(1).split('&').find(elem => elem.startsWith('access_token')).split('=')[1];
            window.localStorage.setItem('spotify_access_token', token);
            window.location.hash = '';
        }
        setAccessToken(token);

        if (token) {
            fetchLikedSongs(token);
        }
    }, []);

    const handleSpotifyLogin = () => {
        setIsLoading(true);
        const scopes = ['user-top-read'];
        const authUrl = `${SPOTIFY_AUTH_ENDPOINT}?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${SPOTIFY_REDIRECT_URI}&scope=${scopes.join(' ')}&response_type=token&show_dialog=true`;
        window.location.href = authUrl;
    };

    const getSpotifyLinks = async (url) => {
        try {
            const proxyUrl = `/spotify-scrape${new URL(url).pathname}`;
            const response = await axios.get(proxyUrl);
            const html = response.data;
            const $ = cheerio.load(html);
            const scdnLinks = new Set();

            $('*').each((i, element) => {
                const attrs = element.attribs;
                Object.values(attrs).forEach(value => {
                    if (value && value.includes('p.scdn.co')) {
                        scdnLinks.add(value);
                    }
                });
            });
            return Array.from(scdnLinks);
        } catch (error) {
            throw new Error(`Failed to fetch preview URLs: ${error.message}`);
        }
    };

    const fetchLikedSongs = async (token) => {
        try {
            setIsLoading(true);
            const response = await axios.get(`${SPOTIFY_API_BASE_URL}/me/top/tracks`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                params: {
                    limit: 25,
                },
            });
            setLikedSongs(response.data.items);
            setIsLoading(false);
        } catch (error) {
            console.error('Error fetching liked songs:', error);
            console.error('Full error response:', error.response);
            setIsLoading(false);
        }
    };

    const startGame = () => {
        if (likedSongs.length > 0) {
            const randomIndex = Math.floor(Math.random() * likedSongs.length);
            const song = likedSongs[randomIndex];
            setCurrentSong(song);
            setGuessResult('');
            setGuessStatus('');
            setUserGuess('');
        } else {
            alert('No liked songs fetched. Please log in and ensure you have liked songs on Spotify.');
        }
    };

    const checkGuess = () => {
        if (!currentSong) return;

        // Stop the audio if it's playing
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        const normalizedGuess = userGuess.trim().toLowerCase();
        const normalizedSongTitle = currentSong.name.trim().toLowerCase();

        if (normalizedSongTitle.includes(normalizedGuess) && normalizedGuess!=='') {
            setGuessResult('Correct!');
            setGuessStatus('correct');
            setCorrectGuesses(correctGuesses + 1);
            if (correctGuesses + 1 >= 3) {
                setAuthStatus('Authenticated!');
                setCurrentSong(null);
                setShowSpotifyAuth(false);
                setIsAuthenticated(true);
            } else {
                setTimeout(startGame, 1500);
            }
        } else {
            setGuessResult(`Incorrect. The song was: ${currentSong.name}`);
            setGuessStatus('incorrect');
            setIncorrectGuesses(incorrectGuesses + 1);
            if (incorrectGuesses + 1 >= 2) {
                setAuthStatus('Not Authenticated');
                setCurrentSong(null);
                setShowSpotifyAuth(false);
                setIsAuthenticated(false);
            }
            setTimeout(startGame, 1500);

        }
    };

    const playPreview = async () => {
        if (currentSong) {
            try {
                console.log(currentSong)
                setIsLoading(true);
                const spotifyUrl = currentSong.external_urls.spotify;
                const previewUrls = await getSpotifyLinks(spotifyUrl);
                setIsLoading(false);

                if (previewUrls && previewUrls.length > 0) {
                    const firstPreviewUrl = previewUrls[0];

                    try {
                        // Store the audio element in the ref so it can be paused later
                        audioRef.current = new Audio(firstPreviewUrl);
                        audioRef.current.play();
                    } catch (audioError) {
                        console.error("Error playing audio with scraped URL:", audioError);
                        alert("Error playing preview. See console for details.");
                    }
                } else {
                    alert('No preview URLs found via scraping.');
                }
            } catch (error) {
                setIsLoading(false);
                console.error("Error fetching preview URLs:", error);
                alert("Error fetching preview. See console for details.");
            }
        } else {
            alert('No song selected for preview.');
        }
    };

    const handleHumanVerification = () => {
        if (!accessToken) {
            setShowSpotifyAuth(true);
        } else {
            startGame();
            setShowSpotifyAuth(true);
        }
    };
    
    const handleLogin = (e) => {
        e.preventDefault();
        // In a real app, you would validate credentials here
        // For now, we'll just consider the user authenticated if they complete the Spotify challenge
        if (isAuthenticated) {
            alert('Login successful!');
        } else {
            alert('Please complete the human verification first.');
        }
    };

    const cancelVerification = () => {
        setShowSpotifyAuth(false);
        setCurrentSong(null);
    };

    return (
        <div className="app-container">
            <h1>Login</h1>
            
            <form className="login-form" onSubmit={handleLogin}>
                <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <input 
                        type="text" 
                        id="username" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        placeholder="Enter your username"
                        required 
                    />
                </div>
                
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input 
                        type="password" 
                        id="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="Enter your password"
                        required 
                    />
                </div>
                
                <div className="human-verification">
                    <label>
                        <input 
                            type="checkbox" 
                            checked={isAuthenticated} 
                            onChange={handleHumanVerification} 
                        />
                        I am a human
                    </label>
                </div>
                
                <button type="submit" className="login-button">Login</button>
            </form>

            {showSpotifyAuth && (
                <div className="popup-overlay">
                    <div className="spotify-auth-popup">
                        <h2>Human Verification</h2>
                        <p>Please verify you're human by guessing songs from your Spotify library</p>
                        
                        {!accessToken ? (
                            <div>
                                <p>Connect your Spotify account to proceed</p>
                                <button 
                                    onClick={handleSpotifyLogin}
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Connecting...' : 'Connect Spotify'}
                                </button>
                                <button 
                                    onClick={cancelVerification} 
                                    className="secondary"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div>
                                {isLoading ? (
                                    <p>Loading your music... please wait</p>
                                ) : likedSongs.length > 0 ? (
                                    <div>
                                        {!currentSong ? (
                                            <div>
                                                <button onClick={startGame}>Start Verification</button>
                                                <button 
                                                    onClick={cancelVerification} 
                                                    className="secondary"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="song-guess-container">
                                                <h3>Guess the Song!</h3>
                                                <button onClick={playPreview}>
                                                    {isLoading ? 'Loading...' : 'Play Preview'}
                                                </button>
                                                <input
                                                    type="text"
                                                    placeholder="Enter song title"
                                                    value={userGuess}
                                                    onChange={(e) => setUserGuess(e.target.value)}
                                                    onKeyPress={(e) => e.key === 'Enter' && checkGuess()}
                                                />
                                                <button onClick={checkGuess}>Submit Guess</button>
                                                
                                                {guessResult && (
                                                    <p className={`guess-result ${guessStatus}`}>
                                                        {guessResult}
                                                    </p>
                                                )}
                                                
                                                <div className="progress-indicator">
                                                    <div 
                                                        className="progress-bar" 
                                                        style={{width: `${(correctGuesses / 3) * 100}%`}}
                                                    ></div>
                                                </div>
                                                <p>Progress: {correctGuesses} / 3 correct</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p>Loading your music... please wait</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;