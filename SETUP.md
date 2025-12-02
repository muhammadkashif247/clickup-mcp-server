# ClickUp MCP Server - Setup Guide

This guide covers three ways to set up the ClickUp MCP Server: NPX (recommended), Local Node.js, and Docker.

## Prerequisites

- **ClickUp API Key**: Get it from [ClickUp Settings > Apps](https://app.clickup.com/settings/apps)
- **ClickUp Team ID**: Found in your workspace URL (`https://app.clickup.com/{TEAM_ID}/...`)

---

## Method 1: NPX Setup (Recommended)

### Step 1: Add MCP Server in Cursor

1. Open Cursor Settings (Cmd+, / Ctrl+,)
2. Navigate to **Tools & MCP**
3. Click **Add MCP Server**
4. Fill in the following:
   - **Name**: `ClickUp`
   - **Command**: `npx`
   - **Args**: `-y`, `@taazkareem/clickup-mcp-server@latest`
   - **Environment Variables**:
     - `CLICKUP_API_KEY`: `your-api-key-here`
     - `CLICKUP_TEAM_ID`: `your-team-id-here`
     - `DOCUMENT_SUPPORT`: `true`

### Step 2: Verify Installation

Test the NPX command manually:

```bash
npx -y @taazkareem/clickup-mcp-server@latest \
  --env CLICKUP_API_KEY=your-api-key \
  --env CLICKUP_TEAM_ID=your-team-id
```

If it runs without errors, the setup is correct.

### Step 3: Restart Cursor

1. Save the MCP server configuration in Cursor settings
2. Completely quit Cursor (Cmd+Q / Alt+F4)
3. Reopen Cursor
4. The server will start automatically when Cursor connects

---

## Method 2: Local Node.js Setup

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Build the Project

```bash
npm run build
```

### Step 3: Add MCP Server in Cursor

1. Open Cursor Settings (Cmd+, / Ctrl+,)
2. Navigate to **Tools & MCP**
3. Click **Add MCP Server**
4. Fill in the following:
   - **Name**: `ClickUp`
   - **Command**: `node`
   - **Args**: `/absolute/path/to/your/project/build/index.js`
     - **Important:** Replace with the actual absolute path to your `build/index.js` file
   - **Environment Variables**:
     - `CLICKUP_API_KEY`: `your-api-key-here`
     - `CLICKUP_TEAM_ID`: `your-team-id-here`
     - `DOCUMENT_SUPPORT`: `true`

### Step 4: Verify Installation

Test the server manually:

```bash
CLICKUP_API_KEY=your-api-key \
CLICKUP_TEAM_ID=your-team-id \
node build/index.js
```

If it runs without errors, the setup is correct.

### Step 5: Restart Cursor

1. Save the MCP server configuration in Cursor settings
2. Completely quit Cursor
3. Reopen Cursor
4. The server will start automatically

---

## Method 3: Docker Setup

### Step 1: Build Docker Image

```bash
docker build -t clickup-mcp-server .
```

### Step 2: Run Docker Container

```bash
docker run -d \
  --name clickup-mcp \
  -e CLICKUP_API_KEY=your-api-key \
  -e CLICKUP_TEAM_ID=your-team-id \
  -e DOCUMENT_SUPPORT=true \
  -e ENABLE_SSE=true \
  -e PORT=3231 \
  -p 3231:3231 \
  clickup-mcp-server
```

### Step 3: Verify Container is Running

```bash
docker ps | grep clickup-mcp
```

### Step 4: Test HTTP Endpoint

```bash
curl http://localhost:3231/health
```

Expected response: `{"status":"ok"}`

### Step 5: Add MCP Server in Cursor

For Docker, configure Cursor to connect via HTTP:

1. Open Cursor Settings (Cmd+, / Ctrl+,)
2. Navigate to **Tools & MCP**
3. Click **Add MCP Server**
4. Fill in the following:
   - **Name**: `ClickUp`
   - **Server URL**: `http://localhost:3231/mcp`
   - Or configure your MCP client to connect to `http://localhost:3231/mcp`

### Step 6: Restart Cursor

1. Save the MCP server configuration in Cursor settings
2. Completely quit Cursor
3. Reopen Cursor
4. Verify connection to the Docker container

---

## Troubleshooting

### Server Not Starting

1. **Check Node.js version:**

   ```bash
   node --version  # Should be >= 18.0.0
   ```

2. **Verify credentials are correct:**

   - API Key format: `pk_...`
   - Team ID is numeric

### Cursor Not Connecting

1. Verify MCP server configuration in Cursor Settings → Tools & MCP
2. Check that credentials are properly set in environment variables
3. Restart Cursor completely (not just reload)
4. Check Cursor logs for MCP connection errors

### Docker Issues

1. **Container not starting:**

   ```bash
   docker logs clickup-mcp
   ```

2. **Port already in use:**

   ```bash
   # Change port in docker run command
   -p 3232:3231
   ```

3. **Container keeps restarting:**
   ```bash
   docker logs clickup-mcp
   # Check for missing environment variables
   ```

---

## Verification Checklist

- [ ] ClickUp API Key obtained
- [ ] ClickUp Team ID obtained
- [ ] MCP server added in Cursor Settings → Tools & MCP
- [ ] Server tested manually (for NPX/Local)
- [ ] Cursor restarted completely
- [ ] MCP connection verified in Cursor

---

## Next Steps

Once connected, you can use natural language commands in Cursor:

- "Get my ClickUp workspace hierarchy"
- "Create a task called 'Review PR' in my 'Development' list"
- "Show me all tasks in the 'Sprint Planning' list"
- "Create a tag called 'urgent' with red color"
