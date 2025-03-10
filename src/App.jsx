import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import * as cheerio from 'cheerio';

const SPOTIFY_CLIENT_ID = '4ec4fff643014cdfa7e990272bbc815f';
const SPOTIFY_REDIRECT_URI = 'http://localhost:5173';
const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

function App() {
    const [accessToken, setAccessToken] = useState(null);
    const [likedSongs, setLikedSongs] = useState([]);
    const [currentSong, setCurrentSong] = useState(null);
    const [userGuess, setUserGuess] = useState('');
    const [guessResult, setGuessResult] = useState('');
    const [correctGuesses, setCorrectGuesses] = useState(0);
    const [authStatus, setAuthStatus] = useState('Not Authenticated');
    const [showPopup, setShowPopup] = useState(false);

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
            const response = await axios.get(`${SPOTIFY_API_BASE_URL}/me/top/tracks`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                params: {
                    limit: 10,
                },
            });
            setLikedSongs(response.data.items);
        } catch (error) {
            console.error('Error fetching liked songs:', error);
            console.error('Full error response:', error.response);
        }
    };

    const startGame = () => {
        if (likedSongs.length > 0) {
            const randomIndex = Math.floor(Math.random() * likedSongs.length);
            const song = likedSongs[randomIndex];
            setCurrentSong(song);
            setGuessResult('');
            setUserGuess('');
        } else {
            alert('No liked songs fetched. Please log in and ensure you have liked songs on Spotify.');
        }
    };

    const checkGuess = () => {
        if (!currentSong) return;

        const normalizedGuess = userGuess.trim().toLowerCase();
        const normalizedSongTitle = currentSong.name.trim().toLowerCase();

        if (normalizedGuess === normalizedSongTitle) {
            setGuessResult('Correct!');
            setCorrectGuesses(correctGuesses + 1);
            if (correctGuesses + 1 >= 3) {
                setAuthStatus('Authenticated!');
                setCurrentSong(null);
                setShowPopup(false)
            } else {
                setTimeout(startGame, 1500);
            }
        } else {
            setGuessResult(`Incorrect. The song was: ${currentSong.name}`);
            setCurrentSong(null);
        }
    };

    const playPreview = async () => {
        if (currentSong) {
            const spotifyUrl = currentSong.external_urls.spotify;
            const previewUrls = await getSpotifyLinks(spotifyUrl);

            if (previewUrls && previewUrls.length > 0) {
                const firstPreviewUrl = previewUrls[0];

                try {
                    const audioElement = new Audio(firstPreviewUrl);
                    audioElement.play();
                } catch (audioError) {
                    console.error("Error playing audio with scraped URL:", audioError);
                    alert("Error playing preview. See console for details.");
                }

            } else {
                alert('No preview URLs found via scraping.');
            }
        } else {
            alert('No song selected for preview.');
        }
    };

    const handleAuthenticate = () => {
        setShowPopup(true);
        startGame();
    };

    return (
        <div className="app-container">
            <h1>Spotify 2FA - Guess the Song</h1>

            {!accessToken ? (
                <button onClick={handleSpotifyLogin}>Login with Spotify</button>
            ) : (
                <div>
                    <p>Logged in with Spotify!</p>

                    {likedSongs.length > 0 && (
                        <div>
                            {authStatus !== 'Authenticated!' ? (
                                <div>
                                    {correctGuesses < 3 && !currentSong && (
                                        <button onClick={handleAuthenticate}>Authenticate</button>
                                    )}

                                    {showPopup && currentSong && (
                                        <div className="popup">
                                            <div className="popup-content">
                                                <h2>Guess the Song!</h2>
                                                <button onClick={playPreview}>Play Preview</button>
                                                <input
                                                    type="text"
                                                    placeholder="Enter song title"
                                                    value={userGuess}
                                                    onChange={(e) => setUserGuess(e.target.value)}
                                                />
                                                <button onClick={checkGuess}>Check Guess</button>
                                                {guessResult && <p>{guessResult}</p>}
                                                <p>Correct Guesses: {correctGuesses} / 3</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="auth-success">
                                    <h2>{authStatus}</h2>
                                    <p>You have successfully authenticated!</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default App;