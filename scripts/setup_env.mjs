import { spawn, execSync } from 'child_process';

console.log('🚀 Starting Local Agent and Cloudflare Tunnel Setup...');

// 1. Start agent
const agentProcess = spawn('npm', ['run', 'dev:agent'], {
  stdio: 'pipe',
  shell: true
});

agentProcess.stdout.on('data', data => console.log(`[AGENT]: ${data.toString().trim()}`));
agentProcess.stderr.on('data', data => console.error(`[AGENT ERROR]: ${data.toString().trim()}`));

// 2. Start Cloudflare Tunnel
const cloudflaredProcess = spawn('.\\cloudflared.exe', ['tunnel', '--url', 'http://localhost:7777'], {
  shell: true
});

let tunnelUrl = '';

cloudflaredProcess.stderr.on('data', (data) => {
  const output = data.toString();
  
  // Try to match the Cloudflare URL
  const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !tunnelUrl) {
    tunnelUrl = match[0];
    const wsUrl = tunnelUrl.replace('https://', 'wss://');
    console.log(`\n==========================================`);
    console.log(`✅ FOUND TUNNEL URL: ${wsUrl}`);
    console.log(`==========================================\n`);
    
    // Process Vercel updates
    updateVercel(wsUrl);
  } else if (!tunnelUrl) {
    // Only print tunnel logs while waiting for the URL to avoid spam
    console.log(`[TUNNEL]: ${output.trim()}`);
  }
});

function updateVercel(wsUrl) {
  try {
    console.log('🔄 Removing old Vercel environment variable (this might take a few seconds)...');
    try {
      execSync('npx vercel env rm NEXT_PUBLIC_AGENT_WS_URL production -y', { stdio: 'pipe', shell: true });
    } catch(e) {
      // Ignore if variable does not exist
    }
    
    console.log('➕ Adding new Vercel environment variable...');
    execSync(`npx vercel env add NEXT_PUBLIC_AGENT_WS_URL production --value "${wsUrl}" --yes`, { stdio: 'inherit', shell: true });
    
    console.log('🚀 Redeploying to Vercel (this may take a minute or two)...');
    execSync('npx vercel --prod --yes', { stdio: 'inherit', shell: true });
    
    console.log(`\n==========================================`);
    console.log('🎉 DEPLOYMENT COMPLETE! You can now use the demo on Vercel.');
    console.log('⚠️  DO NOT CLOSE THIS WINDOW. Keep it open while presenting!');
    console.log(`==========================================\n`);
  } catch (e) {
    console.error('❌ Failed to update or deploy to Vercel.', e.message);
  }
}

process.on('SIGINT', () => {
  console.log('Shutting down...');
  agentProcess.kill();
  cloudflaredProcess.kill();
  process.exit();
});
