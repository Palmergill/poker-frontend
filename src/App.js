// src/App.js - Updated with CreateTable and GameSummary routes
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Register from './components/Register';
import Profile from './components/Profile';
import TableList from './components/TableList';
import TableDetail from './components/TableDetail';
import CreateTable from './components/CreateTable';
import PokerTable from './components/PokerTable';
import GameSummary from './components/GameSummary';
import MatchHistory from './components/MatchHistory';
import PrivateRoute from './components/PrivateRoute';
import './App.css';

function AppContent() {
  const location = useLocation();
  const [connectionStatus, setConnectionStatus] = useState(null);

  // Check if current route is a poker table view
  const isPokerTableView = location.pathname.match(/^\/games\/\d+$/);

  return (
    <div className="App">
      <Navbar connectionStatus={isPokerTableView ? connectionStatus : null} />
      
      <main className={`main-content ${isPokerTableView ? 'poker-table-view' : ''}`}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/profile" element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } />
          
          <Route path="/history" element={
            <PrivateRoute>
              <MatchHistory />
            </PrivateRoute>
          } />
          
          <Route path="/tables" element={
            <PrivateRoute>
              <TableList />
            </PrivateRoute>
          } />
          
          <Route path="/tables/create" element={
            <PrivateRoute>
              <CreateTable />
            </PrivateRoute>
          } />
          
          <Route path="/tables/:id" element={
            <PrivateRoute>
              <TableDetail />
            </PrivateRoute>
          } />
          
          <Route path="/games/:id" element={
            <PrivateRoute>
              <PokerTable onConnectionStatusChange={setConnectionStatus} />
            </PrivateRoute>
          } />
          
          <Route path="/games/:gameId/summary" element={
            <PrivateRoute>
              <GameSummary />
            </PrivateRoute>
          } />
          
          <Route path="/" element={<Navigate to="/tables" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;