const email = "test@test.com";
const password = "password123";

fetch("http://localhost:3000/api/auth/callback/credentials", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({ email, password, redirect: "false", callbackUrl: "http://localhost:3000/dashboard" }).toString(),
}).then(res => res.json()).then(console.log).catch(console.error);
