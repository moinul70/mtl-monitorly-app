# MTL Monitorly

A modern, Node.js-powered observability platform designed to monitor machine performance metrics and multiple external API health in real-time in one place.

## About

MTL Monitorly is a lightweight monitoring solution that tracks critical system metrics including CPU usage, RAM consumption, and system uptime. It also displays real-time multiple API metrics from external sources and provides instant alerts when thresholds are exceeded, ensuring you stay informed about your system's health.

## Features

- 🖥️ **System Metrics Monitoring**
  - Real-time CPU/Processor monitoring
  - RAM usage tracking and analysis
  - System uptime calculation and display
  
- 🚨 **Smart Threshold Alerts**
  - Configurable alert thresholds for CPU and RAM
  - Instant notifications when thresholds are exceeded
  - Visual alert indicators on dashboard

- 📊 **External API Metrics**
  - Display metrics from external API endpoints
  - Real-time data synchronization
  - Integration with multiple data sources

- ⚡ **Lightweight & Fast**
  - Built with Express.js for optimal performance
  - SQLite database for quick data access
  - Responsive UI with Tailwind CSS

- 🎨 **Modern UI**
  - Beautiful, responsive design with Tailwind CSS
  - EJS templating for dynamic content rendering
  - Clean and intuitive user interface

## Installation

### Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v22.0.0 or higher)
- npm (comes with Node.js)
- Git

### Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/moinul70/mtl-monitorly-app.git
   cd mtl-monitorly-app
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file with your settings:
   ```
   PORT=3000
   NODE_ENV=development
   EXTERNAL_API_URL=<your-external-api-endpoint>
   CPU_THRESHOLD=80
   RAM_THRESHOLD=85
   ```

4. **Build CSS (Optional - for production)**
   ```bash
   npm run build:css
   ```

5. **Start the Application**
   
   **Development Mode (with auto-reload):**
   ```bash
   npm run dev
   ```
   
   **Production Mode:**
   ```bash
   npm start
   ```

6. **Access the Application**
   Open your browser and navigate to `http://localhost:3000`

## Project Structure

```
mtl-monitorly-app/
├── src/
│   ├── public/              # Static files (CSS, images, JS)
│   ├── views/               # EJS template files
│   ├── css/                 # Tailwind CSS input files
│   ├── apiMetrics/          # External API metrics module
│   ├── server.js            # Express server setup
│   └── router.js            # Route definitions
├── .env.example             # Environment variables template
├── package.json             # Project dependencies and scripts
└── README.md                # This file
```


## Technologies Used

| Technology | Purpose |
|-----------|---------|
| **Express.js** | Web framework and server |
| **Node.js** | Runtime environment |
| **SQLite (better-sqlite3)** | Lightweight database |
| **EJS** | Template engine for dynamic views |
| **Tailwind CSS** | Utility-first CSS framework |
| **Dotenv** | Environment variable management |

## Usage

1. **Start the server** using `npm start` or `npm run dev`
2. **Access the dashboard** at `http://localhost:3000`
3. **Monitor System Metrics:**
   - View real-time CPU usage
   - Track RAM consumption
   - Check system uptime
4. **External API Metrics:**
   - View metrics from configured external APIs
   - Data updates in real-time
5. **Receive Alerts:**
   - Automatic alerts when CPU threshold is exceeded
   - Automatic alerts when RAM threshold is exceeded
   - Visual and/or notification-based alerts

## Available Scripts

```bash
# Start the production server
npm start

# Start development server with auto-reload
npm run dev

# Build Tailwind CSS (minified)
npm run build:css

# Watch Tailwind CSS files for changes
npm run watch:css
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# External API Configuration
EXTERNAL_API_URL=https://api.example.com/metrics

# Alert Thresholds (percentage)
CPU_THRESHOLD=80
RAM_THRESHOLD=85

# Database Configuration (optional)
DB_PATH=./data/monitorly.db
```

## API Endpoints

### System Metrics
- `GET /api/system/metrics` — Get current system metrics (CPU, RAM, uptime)

### External API Metrics
- `GET /api/metrics` — Get metrics from external API endpoints

### Dashboard
- `GET /` — Main dashboard page

## Development

### Tailwind CSS Development

To watch for CSS changes during development:

```bash
npm run watch:css
```

This will automatically rebuild the CSS file whenever changes are made to the input CSS.

## Performance Considerations

- SQLite database is optimized for single-instance deployments
- Metrics are collected and stored efficiently
- Lightweight design ensures minimal resource overhead
- Real-time updates via efficient polling mechanism

## Troubleshooting

### Port Already in Use
```bash
# Change port in .env file
PORT=3001
```

### Database Issues
- Ensure the `data/` directory exists and is writable
- Check database file permissions

### External API Not Connecting
- Verify the `EXTERNAL_API_URL` in `.env`
- Check network connectivity
- Ensure external API is accessible

## Future Enhancements

- [ ] WebSocket support for real-time updates
- [ ] Historical data visualization and charts
- [ ] Configurable alert notifications (Email, Slack, etc.)
- [ ] Multi-server monitoring
- [ ] Dashboard customization
- [ ] User authentication and roles

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions, please open an issue on GitHub: [MTL Monitorly Issues](https://github.com/moinul70/mtl-monitorly-app/issues)

## Author

**Moinul** - [GitHub Profile](https://github.com/moinul70)

---

**Version:** 1.0.0  

