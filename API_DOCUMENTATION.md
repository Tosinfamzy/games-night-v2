# Games Night API Documentation

## Overview

The Games Night API is a comprehensive REST API built with NestJS for managing game night sessions. It provides functionality for managing games masters, sessions, players, teams, games, and scoring.

## Core Features

### 1. Games Master Management

- Create and manage games masters who host sessions
- Track all sessions hosted by a games master
- View active sessions for a games master

**Endpoints:**

- `POST /games-master` - Create a new games master
- `GET /games-master` - List all games masters
- `GET /games-master/:id` - Get a specific games master
- `GET /games-master/:id/active-sessions` - Get active sessions for a games master
- `PUT /games-master/:id` - Update a games master
- `DELETE /games-master/:id` - Delete a games master

### 2. Session Management

- Create gaming sessions with dates and hosts
- Track all players and teams in a session
- View session details including games played

**Endpoints:**

- `POST /sessions` - Create a new session
- `GET /sessions` - List all sessions
- `GET /sessions/:id` - Get a specific session
- `PUT /sessions/:id` - Update a session
- `DELETE /sessions/:id` - Delete a session

### 3. Player Management

- Register players for sessions
- Track player participation across sessions
- Manage player teams

**Endpoints:**

- `POST /players` - Create a new player
- `GET /players` - List all players
- `GET /players/:id` - Get a specific player
- `PUT /players/:id` - Update a player
- `DELETE /players/:id` - Delete a player

### 4. Team Management

- Create and manage teams
- Assign players to teams
- Track team performance

**Endpoints:**

- `POST /teams` - Create a new team
- `GET /teams` - List all teams
- `GET /teams/:id` - Get a specific team
- `PUT /teams/:id` - Update a team
- `DELETE /teams/:id` - Delete a team

### 5. Game Management

- Create and manage different games
- Track game sessions
- Associate teams with games

**Endpoints:**

- `POST /games` - Create a new game
- `GET /games` - List all games
- `GET /games/:id` - Get a specific game
- `PUT /games/:id` - Update a game
- `DELETE /games/:id` - Delete a game

### 6. Scoring System

- Record game scores
- Calculate team standings
- Track bonus points
- Generate game statistics

**Endpoints:**

- `POST /scores` - Create a new score
- `GET /scores/games/:gameId` - Get scores for a specific game
- `POST /scores/games/:gameId/submit` - Submit scores for a game

## Technical Details

### Authentication & Security

- UUID-based resource identification
- Input validation using class-validator
- Rate limiting to prevent abuse
- Redis-based caching for improved performance

### Data Persistence

- PostgreSQL database with TypeORM
- Proper relation handling between entities
- Transaction support for data integrity

### API Features

- Comprehensive Swagger documentation
- Proper error handling and status codes
- Pagination for large datasets
- Efficient relation loading
- Caching for frequently accessed data

## Missing Features / Potential Improvements

1. Game Session Flow
   - Need to implement game start/end logic
   - Add round management within games
   - Track game progress status

2. Team Formation
   - Add team size validation
   - Implement team balancing logic
   - Add team invitation system

3. Scoring Rules
   - Implement specific game scoring rules
   - Add score validation logic
   - Implement tie-breaking mechanisms
   - Add support for different scoring systems

4. Player Statistics
   - Track player performance metrics
   - Calculate player rankings
   - Generate player history
   - Track player achievements

5. Session Management
   - Add session scheduling
   - Implement session RSVP system
   - Add session capacity limits
   - Handle session cancellations

6. Game Types
   - Add support for different game types
   - Implement game-specific rules
   - Add game difficulty levels
   - Support team vs individual games

## Environment Setup

### Prerequisites

- Node.js >= 14
- PostgreSQL >= 13
- Redis >= 6

### Configuration

The application uses environment variables for configuration:

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=games_night
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Running the Application

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the application:

   ```bash
   npm run start:dev
   ```

3. Access the Swagger documentation:
   ```
   http://localhost:3000/api
   ```

## Entity Relationships

- **GamesMaster** -> **Sessions** (1:N)
- **Session** -> **Players** (1:N)
- **Session** -> **Games** (1:N)
- **Game** -> **Teams** (1:N)
- **Team** -> **Players** (N:M)
- **Game** -> **Scores** (1:N)
- **Team** -> **Scores** (1:N)

## Project Structure

```
src/
├── games-master/
├── session/
├── player/
├── game/
├── team/
├── score/
├── config/
└── main.ts
```
