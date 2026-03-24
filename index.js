require("dotenv").config();

// Start AVA signal server
require("./src/api/server");

// Start AVA trading loop
setTimeout(() => {
  require("./src/agent/loop");
}, 3000);

// Start NOVA agent
setTimeout(() => {
  require("./src/nova/agent");
}, 6000);

console.log("🚀 AVA ecosystem starting...");