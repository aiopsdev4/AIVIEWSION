module.exports = {
  apps: [
    {
      name: "aiviewsion-backend",
      script: "docker-compose",
      args: "up",
      cwd: "/home/hypernet-dev/AIVIEWSION",
      interpreter: "none",
      env: {
        DOCKER_API_VERSION: "1.44"
      }
    },
    {
      name: "aiviewsion-frontend",
      script: "npx",
      args: "vite --host --port 5173",
      cwd: "/home/hypernet-dev/AIVIEWSION/web",
      env: {
        PROXY_HOST: "localhost:5000"
      }
    }
  ]
}
