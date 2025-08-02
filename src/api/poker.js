// src/api/poker.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://poker-backend-production-da44.up.railway.app/api';

const pokerApi = {
  // Tables
  getTables: () => axios.get(`${API_URL}/tables/`),
  getTable: (id) => axios.get(`${API_URL}/tables/${id}/`),
  
  // Players
  getPlayers: () => axios.get(`${API_URL}/players/`),
  getPlayer: (id) => axios.get(`${API_URL}/players/${id}/`),
  
  // Games
  getGames: () => axios.get(`${API_URL}/games/`),
  getGame: (id) => axios.get(`${API_URL}/games/${id}/`),
  
  // Player Games
  getPlayerGames: () => axios.get(`${API_URL}/player-games/`),
  getPlayerGame: (id) => axios.get(`${API_URL}/player-games/${id}/`),
};

export default pokerApi;