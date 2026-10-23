// Lets Jest load ES-module files (the frontend's shared utils); Vite ignores this file
module.exports = {
  presets: [["@babel/preset-env", { targets: { node: "current" } }]],
};
