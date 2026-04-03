require("dotenv").config();

// Start AVA signal server
const app = require("./src/api/server");

// Mount MCP server
const mcpApp = require("./src/mcp/server");
app.use(mcpApp);

// Start AVA trading loop
setTimeout(() => {
  require("./src/agent/loop");
}, 3000);

// Start NOVA agent
setTimeout(() => {
  require("./src/nova/agent");
}, 6000);

console.log("🚀 AVA ecosystem starting...");