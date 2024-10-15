module.exports = {
    apps: [
      {
        name: 'webtopdf',
        script: 'npm',
        args: 'start',
        env: {
          NODE_ENV: 'production'
        }
      }
    ]
  };
  