# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React frontend for a multiplayer poker application with real-time WebSocket communication. It's built with Create React App and designed for deployment on Railway as a static site.

## Development Commands

- `npm start` - Run development server on http://localhost:3000
- `npm run build` - Build production bundle to `build/` folder
- `npm test` - Run tests in interactive watch mode
- `npm run eject` - Eject from Create React App (one-way operation)

## Environment Variables

Required for proper functionality:
- `REACT_APP_API_URL` - Backend API URL (e.g., https://your-backend.railway.app/api)
- `REACT_APP_WS_URL` - Backend WebSocket URL (e.g., wss://your-backend.railway.app/ws)

## Architecture

### Core Services (`src/services/`)
- **apiService.js** - Main service with JWT authentication, token refresh, and comprehensive API methods
- **poker.js** - Legacy API wrapper (consider using apiService.js for new features)

### Authentication System
- JWT-based with automatic token refresh via axios interceptors
- Token storage in localStorage with fallback to login redirect
- Admin privilege checking via user metadata

### Real-time Communication
- WebSocket connections managed through `gameService.connectToGameSocket()`
- Handles authentication via token in URL params
- Custom error codes for connection issues (4001: auth failed, 4003: permission denied, 4004: game not found)

### Component Structure
- **App.js** - Main router with private route protection and connection status management
- **PokerTable.js** - Core game interface with real-time updates and betting controls
- Authentication components (Login, Register) with PrivateRoute wrapper
- Game management (CreateTable, TableList, TableDetail, GameSummary)
- Bot management with configurable difficulty and play styles

### State Management
- Component-level state with React hooks
- WebSocket message handling for real-time game state updates
- Connection status propagation to navbar

### Key Features
- Multi-table poker gameplay with bot opponents
- Real-time betting interface with sliders and action buttons
- Match history and game summaries
- Administrative functions (table/game deletion, bot management)
- Responsive design for desktop and mobile

### API Integration Patterns
- Centralized error handling with automatic token refresh
- Service-based architecture separating auth, player, table, game, and bot operations
- WebSocket connection management with reconnection handling

### Deployment
- Railway static site deployment with Nginx
- Multi-stage Docker build (node builder + nginx production)
- Health checks and non-root user security