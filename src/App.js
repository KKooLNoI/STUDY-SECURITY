import { useState, useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
   COLOURS
═══════════════════════════════════════════════════════════ */
const LC = {
  L7:  {bg:"#6d28d9",lt:"#ede9fe",tx:"#4c1d95",br:"#c4b5fd"},
  L8:  {bg:"#dc2626",lt:"#fee2e2",tx:"#7f1d1d",br:"#fca5a5"},
  L9:  {bg:"#d97706",lt:"#fef3c7",tx:"#78350f",br:"#fcd34d"},
  L10: {bg:"#059669",lt:"#d1fae5",tx:"#064e3b",br:"#6ee7b7"},
  L11: {bg:"#0284c7",lt:"#e0f2fe",tx:"#0c4a6e",br:"#7dd3fc"},
  L12: {bg:"#ea580c",lt:"#ffedd5",tx:"#7c2d12",br:"#fdba74"},
  L13: {bg:"#db2777",lt:"#fce7f3",tx:"#831843",br:"#f9a8d4"},
};
const LNAMES={L7:"Web Security",L8:"Network/DoS",L9:"IDS/FW/IPS",L10:"IoT Security",L11:"Cloud",L12:"Security Mgmt",L13:"Legal & Ethics"};
const LECS=["All","L7","L8","L9","L10","L11","L12","L13"];

/* ═══════════════════════════════════════════════════════════
   STORAGE HELPERS
═══════════════════════════════════════════════════════════ */
const STORAGE_KEY = "css-study-progress-v1";

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveProgress(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function initProgress() {
  return {
    // mode → { attempts:[{date,score,total,pct}], lastScore:null, totalAttempts:0 }
    quiz:  { attempts:[], totalCorrect:0, totalAnswered:0 },
    tf:    { attempts:[], totalCorrect:0, totalAnswered:0 },
    sa:    { attempts:[], totalCorrect:0, totalAnswered:0 },
    cards: { known:[], totalSeen:0 },
    // per-lecture stats
    lecStats: {}, // lecStats[lec][mode] = {correct,total}
    lastUpdated: null,
  };
}

/* ═══════════════════════════════════════════════════════════
   SHUFFLE
═══════════════════════════════════════════════════════════ */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ═══════════════════════════════════════════════════════════
   DATA
═══════════════════════════════════════════════════════════ */
const FC_BASE=[
  {id:1,lec:"L7",tag:"Web Security",q:"What does OWASP stand for and what is its #1 vulnerability in 2025?",a:"Open Web Application Security Project. #1 = Broken Access Control (A01:2025) — users accessing resources beyond their permissions.",stars:3},
  {id:2,lec:"L7",tag:"Web Security",q:"What is SQL Injection and how do you prevent it?",a:"Injecting malicious SQL via input fields to steal/modify data. Prevent with Parameterized Queries (Prepared Statements) + server-side input validation.",stars:3},
  {id:3,lec:"L7",tag:"Web Security",q:"What is XSS? Name Stored vs Reflected.",a:"Cross-Site Scripting — injecting scripts into pages other users see. Stored: saved in DB, affects all visitors. Reflected: in URL, requires victim to click.",stars:3},
  {id:4,lec:"L7",tag:"Web Security",q:"How does CSRF attack work?",a:"Tricks browser into sending forged request using active session cookie. User is unaware. Fix: CSRF tokens, SameSite cookies.",stars:3},
  {id:5,lec:"L7",tag:"Web Security",q:"What is a WAF?",a:"Web Application Firewall — inspects HTTP requests/responses, filtering SQLi, XSS, CSRF before reaching the app.",stars:2},
  {id:6,lec:"L7",tag:"SSL/TLS",q:"Why does SSL compress before encrypting?",a:"Encrypted data is random and incompressible. Compress plaintext first → smaller data → then encrypt to protect it.",stars:2},
  {id:7,lec:"L7",tag:"Web Security",q:"What is Session Hijacking?",a:"Stealing a valid Session ID to impersonate a user without knowing their password. Done via XSS, sniffing, or MitM.",stars:2},
  {id:8,lec:"L7",tag:"SSL/TLS",q:"What port does HTTPS use?",a:"Port 443. HTTP = 80. SSL SMTP = 465.",stars:2},
  {id:9,lec:"L7",tag:"OWASP 2025",q:"List OWASP 2025 A01–A05.",a:"A01 Broken Access Control, A02 Security Misconfiguration, A03 Software Supply Chain Failures, A04 Cryptographic Failures, A05 Injection.",stars:3},
  {id:10,lec:"L7",tag:"Web Security",q:"What is Directory Traversal?",a:"Using '../' sequences to escape the web root and access system files like /etc/passwd.",stars:2},
  {id:11,lec:"L8",tag:"Network/DoS",q:"DoS vs DDoS — key difference?",a:"DoS: single source. DDoS: botnet of thousands of Zombies attacking simultaneously — far more traffic, much harder to stop.",stars:3},
  {id:12,lec:"L8",tag:"Network/DoS",q:"How does SYN Flood work?",a:"Sends SYN without ACK — creates half-open connections that exhaust server's connection table. Server can't accept new legitimate connections.",stars:3},
  {id:13,lec:"L8",tag:"Network/DoS",q:"What is a Botnet structure?",a:"Hacker → Master Server → Zombies (compromised machines) → Target. Tools: Tribe Flood Network.",stars:3},
  {id:14,lec:"L8",tag:"Network/DoS",q:"3 defense lines against DoS?",a:"1) Prevention & Preemption (before) 2) Detection & Filtering (during) 3) Source Traceback & Identification (during/after).",stars:3},
  {id:15,lec:"L8",tag:"Network/DoS",q:"What is an Amplification Attack?",a:"Small spoofed request → large response directed at victim (DNS, NTP). Attacker uses minimal bandwidth to flood victim.",stars:2},
  {id:16,lec:"L8",tag:"Network/DoS",q:"What is IP Spoofing?",a:"Forging SOURCE IP in packet headers. Routers only check destination — spoofed sources pass through, making traceback hard.",stars:2},
  {id:17,lec:"L9",tag:"IDS/FW/IPS",q:"IDS vs IPS — key difference?",a:"IDS: passive — monitors and alerts only. IPS: inline/active — detects AND automatically blocks traffic.",stars:3},
  {id:18,lec:"L9",tag:"IDS/FW/IPS",q:"5 types of firewalls?",a:"Packet Filtering, Stateful Inspection, Application-Level Gateway (Proxy), Circuit-Level Gateway, Next-Generation Firewall (NGFW).",stars:3},
  {id:19,lec:"L9",tag:"IDS/FW/IPS",q:"What is Stateful Inspection Firewall?",a:"Tracks connection state in a table (IP, port, TCP seq). Verifies packets belong to legitimate sessions — prevents hijacking and spoofing.",stars:2},
  {id:20,lec:"L9",tag:"IDS/FW/IPS",q:"What is a Honeypot?",a:"Intentionally vulnerable decoy to attract attackers. Lets defenders study TTPs. Risk: can pivot to real systems if misconfigured.",stars:2},
  {id:21,lec:"L9",tag:"IDS/FW/IPS",q:"SNORT's 4 components?",a:"Packet Decoder, Detection Engine, Logger, Alerter. Free open-source NIDS/IPS.",stars:2},
  {id:22,lec:"L9",tag:"IDS/FW/IPS",q:"VPN + IPSec together?",a:"VPN: encrypted tunnel over internet. IPSec: authentication + encryption + integrity at Layer 3. Together = secure remote access.",stars:3},
  {id:23,lec:"L9",tag:"IDS/FW/IPS",q:"What is UTM?",a:"Unified Threat Management — all-in-one: Firewall + IPS + IDS + VPN + Antivirus + Antispam.",stars:2},
  {id:24,lec:"L10",tag:"IoT Security",q:"3 IoT Architecture layers?",a:"Perception (sensors: RFID, ZigBee, BLE) → Network (transmission) → Application (processes + presents data).",stars:3},
  {id:25,lec:"L10",tag:"IoT Security",q:"Passive vs Active attack in WSN?",a:"Passive: eavesdrop only, no modification, hard to detect. Active: modifies/injects data (Sybil, Jamming, HELLO Flooding).",stars:3},
  {id:26,lec:"L10",tag:"IoT Security",q:"4 Hole Attacks?",a:"Blackhole: drops all. Greyhole: drops selectively. Sinkhole: lures traffic claiming best route then manipulates. Wormhole: secret tunnel replaying packets.",stars:3},
  {id:27,lec:"L10",tag:"IoT Security",q:"What is a Sybil Attack?",a:"One malicious node creates multiple fake identities, corrupting distributed algorithms (routing, voting, consensus).",stars:2},
  {id:28,lec:"L11",tag:"Cloud Security",q:"IaaS vs PaaS vs SaaS?",a:"IaaS: VMs/network/storage (AWS EC2). PaaS: dev platform (Heroku). SaaS: ready software (Gmail). Higher = more CSP manages.",stars:3},
  {id:29,lec:"L11",tag:"Cloud Security",q:"5 cloud deployment models?",a:"Public, Private, Community, Hybrid, Multicloud.",stars:3},
  {id:30,lec:"L11",tag:"Cloud Security",q:"Multi-tenancy security risks?",a:"Side-channel attacks (cache timing), VM Escape, Data leakage between tenants, uncoordinated security policies.",stars:3},
  {id:31,lec:"L11",tag:"Cloud Security",q:"3 root causes of cloud security problems?",a:"Loss of Control, Lack of Trust, Multi-Tenancy.",stars:2},
  {id:32,lec:"L12",tag:"Security Mgmt",q:"7 components of a Security Plan?",a:"Policy → Current State → Requirements → Recommended Controls → Accountability → Timetable → Continuing Attention.",stars:3},
  {id:33,lec:"L12",tag:"Security Mgmt",q:"VA vs PT?",a:"VA: automated, quarterly, in-house, known vulns. PT: manual exploit, 1-2×/year, external experts, unknown real paths.",stars:3},
  {id:34,lec:"L12",tag:"Security Mgmt",q:"NIST CSF 2.0 — 6 functions?",a:"Govern (new in v2.0) → Identify → Protect → Detect → Respond → Recover.",stars:3},
  {id:35,lec:"L12",tag:"Security Mgmt",q:"What is BCP?",a:"Business Continuity Plan: keeps operations running during catastrophic + LONG-DURATION outages. Covers revenue, payroll, legal obligations.",stars:2},
  {id:36,lec:"L13",tag:"Legal & Ethics",q:"CCA B.E. 2550 — offenses?",a:"Unauthorized access, Data interference, Forgery, Using false data to harm, Spreading illegal content, Creating/distributing malware.",stars:3},
  {id:37,lec:"L13",tag:"Legal & Ethics",q:"PDPA 72-hour rule?",a:"Data Controller must notify PDPC within 72 hours of learning of a personal data breach (Section 37).",stars:3},
  {id:38,lec:"L13",tag:"Legal & Ethics",q:"Data Controller vs Data Processor?",a:"Controller: decides purpose/means of processing — primary legal responsibility. Processor: processes data per Controller's instructions only.",stars:3},
  {id:39,lec:"L13",tag:"Legal & Ethics",q:"PDPA Section 26 — sensitive data types?",a:"Race/ethnicity, political opinions, religion, sexual behavior, criminal records, health data, disability, trade union, genetic, biometric data. Requires explicit consent.",stars:3},
  {id:40,lec:"L13",tag:"Legal & Ethics",q:"ISO 27001 vs ISO 42001?",a:"ISO 27001: ISMS (data security). ISO 42001: AIMS — AI governance (bias, transparency, model drift, data quality).",stars:2},
];

const TF_BASE=[
  {id:1,lec:"L7",stmt:"OWASP Top 10 2025 ranks Broken Access Control as #1.",ans:true,exp:"Correct. A01:2025 is Broken Access Control — so widespread it tops the list over Injection for the first time."},
  {id:2,lec:"L7",stmt:"SQL Injection can be fully prevented by client-side JavaScript validation alone.",ans:false,exp:"False. Client-side validation is trivially bypassed. Server-side parameterized queries (prepared statements) are required."},
  {id:3,lec:"L7",stmt:"XSS injects malicious scripts that execute in other users' browsers.",ans:true,exp:"Correct. XSS embeds attacker scripts into web pages — when another user visits, the script runs in their browser."},
  {id:4,lec:"L7",stmt:"CSRF requires the victim to click a malicious download link to execute.",ans:false,exp:"False. CSRF works by tricking the browser into auto-sending a forged request using the victim's active session cookie — no download needed."},
  {id:5,lec:"L7",stmt:"SSL encrypts data first, then compresses it.",ans:false,exp:"False. SSL compresses FIRST then encrypts. Encrypted data is random and can't be compressed efficiently."},
  {id:6,lec:"L7",stmt:"HTTPS uses port 443 by default.",ans:true,exp:"Correct. HTTP = 80. HTTPS (HTTP over SSL/TLS) = 443."},
  {id:7,lec:"L8",stmt:"In a DDoS attack, all traffic comes from a single machine controlled by the hacker.",ans:false,exp:"False. DDoS uses a Botnet — thousands of Zombie machines. Traffic originates from many sources simultaneously."},
  {id:8,lec:"L8",stmt:"SYN Flood fills the server's connection table with half-open TCP connections.",ans:true,exp:"Correct. SYN sent, ACK never returned — server waits and allocates resources for each half-open connection until full."},
  {id:9,lec:"L8",stmt:"IP Spoofing changes the destination IP address in packets.",ans:false,exp:"False. It forges the SOURCE IP. Routers only check destination addresses, so spoofed sources pass through easily."},
  {id:10,lec:"L8",stmt:"Amplification attacks exploit protocols where responses are much larger than requests.",ans:true,exp:"Correct. DNS/NTP amplification: small spoofed request → massive response directed at victim."},
  {id:11,lec:"L9",stmt:"IPS is a passive device that only monitors and sends alerts.",ans:false,exp:"False. That's IDS. IPS is inline and actively blocks malicious traffic automatically in real time."},
  {id:12,lec:"L9",stmt:"Stateful Inspection Firewall maintains a connection state table.",ans:true,exp:"Correct. It tracks IP, port, and TCP sequence numbers to verify each packet belongs to a legitimate established session."},
  {id:13,lec:"L9",stmt:"Packet Filter Firewall can block SQL Injection payloads inside HTTP request bodies.",ans:false,exp:"False. Packet filter only checks headers. Application-Level Gateway is needed to inspect Layer 7 content like HTTP bodies."},
  {id:14,lec:"L9",stmt:"SNORT is a commercial closed-source firewall product.",ans:false,exp:"False. SNORT is a FREE open-source Network IDS/IPS using rule-based detection."},
  {id:15,lec:"L9",stmt:"A Honeypot is an intentionally vulnerable decoy designed to attract attackers.",ans:true,exp:"Correct. Honeypots lure attackers to study their methods (TTPs) and gather threat intelligence."},
  {id:16,lec:"L10",stmt:"The Perception Layer is responsible for transmitting data across the network.",ans:false,exp:"False. Perception Layer GATHERS sensor data. The Network Layer handles transmission."},
  {id:17,lec:"L10",stmt:"A Sybil Attack creates multiple fake node identities from a single physical node.",ans:true,exp:"Correct. One malicious node pretends to be many, corrupting distributed algorithms."},
  {id:18,lec:"L10",stmt:"Passive attacks in WSN are easier to detect than Active attacks.",ans:false,exp:"False. Opposite. Passive attacks (eavesdropping) generate no anomalous traffic — IDS has nothing to detect."},
  {id:19,lec:"L11",stmt:"In SaaS, the cloud user manages the underlying operating system.",ans:false,exp:"False. In SaaS the CSP manages everything. The user only interacts with the software interface."},
  {id:20,lec:"L11",stmt:"Multi-tenancy means multiple organizations share the same physical infrastructure.",ans:true,exp:"Correct. Multi-tenancy reduces costs but creates risks: side-channel, VM escape, data leakage between tenants."},
  {id:21,lec:"L11",stmt:"Multicloud strategy eliminates vendor lock-in but increases governance complexity.",ans:true,exp:"Correct. Multiple CSPs = no single-vendor dependency, but security/compliance management across providers is significantly more complex."},
  {id:22,lec:"L12",stmt:"NIST CSF 2.0 added 'Govern' as a new Core Function, making 6 total.",ans:true,exp:"Correct. v1.1 had 5 functions. v2.0 adds Govern for strategic cybersecurity risk management at leadership level."},
  {id:23,lec:"L12",stmt:"A Business Continuity Plan only covers short IT outages of a few hours.",ans:false,exp:"False. BCP specifically handles CATASTROPHIC + LONG-DURATION situations where business operations (revenue, payroll, legal) are at risk."},
  {id:24,lec:"L13",stmt:"Thailand's CCA B.E. 2550 was the first computer crime law enacted.",ans:true,exp:"Correct. CCA B.E. 2550 (2007) was Thailand's first. Amended in B.E. 2560 (2017)."},
  {id:25,lec:"L13",stmt:"Under PDPA, the Data Controller must notify PDPC within 72 hours of a breach.",ans:true,exp:"Correct. PDPA Section 37 requires notification within 72 hours unless the breach is unlikely to risk data subjects' rights."},
  {id:26,lec:"L13",stmt:"Under PDPA Section 26, health data can never be collected under any circumstances.",ans:false,exp:"False. Collection is prohibited WITHOUT explicit consent, but exceptions exist: preventing danger to life/health, or when data subject cannot consent."},
  {id:27,lec:"L7",stmt:"A WAF (Web Application Firewall) can filter both SQL Injection and XSS attacks.",ans:true,exp:"Correct. WAF inspects HTTP request/response and filters known attack patterns including SQLi, XSS, CSRF, and DoS."},
  {id:28,lec:"L8",stmt:"SYN Cookies prevent SYN Flood by allocating server resources after a valid ACK is received.",ans:true,exp:"Correct. SYN Cookie encodes state in the SYN-ACK sequence number — server allocates nothing until valid ACK confirms the handshake."},
  {id:29,lec:"L11",stmt:"CP-ABE allows cloud users to rely entirely on the CSP for encryption key management.",ans:false,exp:"False. CP-ABE is used specifically to avoid trusting CSP. Users define their own access policies over encrypted data."},
  {id:30,lec:"L12",stmt:"ISO 42001 focuses on AI governance, while ISO 27001 focuses on data security.",ans:true,exp:"Correct. ISO 42001 = AI Management System (bias, transparency, model drift). ISO 27001 = ISMS for information security."},
];

const QZ_BASE=[
  {id:1,lec:"L7",sec:"Knowledge",q:"OWASP 2025 #1 vulnerability is:",opts:["Injection","Broken Access Control","Security Misconfiguration","Cryptographic Failures"],ans:1,exp:"A01:2025 = Broken Access Control."},
  {id:2,lec:"L7",sec:"Knowledge",q:"XSS stands for:",opts:["Cross-Site Scripting","Cross-Server Spoofing","Cross-System Security","Coded Script Exploit"],ans:0,exp:"XSS = Cross-Site Scripting."},
  {id:3,lec:"L7",sec:"Knowledge",q:"SQL Injection is best prevented by:",opts:["Client-side validation","Parameterized Queries / Prepared Statements","Firewall rules","Strong passwords"],ans:1,exp:"Parameterized queries separate SQL code from data — user input is never interpreted as SQL."},
  {id:4,lec:"L7",sec:"Knowledge",q:"HTTPS uses port:",opts:["80","8080","443","465"],ans:2,exp:"HTTPS = 443. HTTP = 80."},
  {id:5,lec:"L7",sec:"Knowledge",q:"SSL processes data in which order?",opts:["Encrypt then compress","Compress then encrypt","Compress only","Encrypt only"],ans:1,exp:"Compress first (plaintext compresses better), then encrypt."},
  {id:6,lec:"L8",sec:"Knowledge",q:"DDoS differs from DoS because:",opts:["DDoS uses UDP only","DDoS originates from many machines simultaneously","DDoS only targets databases","DDoS encrypts traffic"],ans:1,exp:"DDoS = Distributed — botnet of Zombies from many sources simultaneously."},
  {id:7,lec:"L8",sec:"Knowledge",q:"A compromised machine in a DDoS botnet is called a:",opts:["Master Server","Zombie","Daemon","Firewall"],ans:1,exp:"Zombies are remotely controlled via Master Server to launch attacks."},
  {id:8,lec:"L8",sec:"Knowledge",q:"SYN Flood exploits:",opts:["UDP broadcast","TCP 3-way handshake — half-open connections","DNS amplification","ICMP echo"],ans:1,exp:"Sends SYN without ACK, exhausting connection table with half-open entries."},
  {id:9,lec:"L9",sec:"Knowledge",q:"IPS differs from IDS in that IPS can:",opts:["Send email alerts","Block/drop malicious traffic automatically","Scan for vulnerabilities","Generate reports"],ans:1,exp:"IPS is inline and actively blocks. IDS only detects and alerts."},
  {id:10,lec:"L9",sec:"Knowledge",q:"How many firewall types are covered?",opts:["3","4","5","6"],ans:2,exp:"5: Packet Filter, Stateful Inspection, Application Gateway, Circuit Gateway, NGFW."},
  {id:11,lec:"L9",sec:"Knowledge",q:"UTM combines:",opts:["Router+Switch+Hub","Firewall+IPS+IDS+VPN+Antivirus","OS+Database+Webserver","Scanner+Logger+Sniffer"],ans:1,exp:"UTM = all-in-one security appliance."},
  {id:12,lec:"L10",sec:"Knowledge",q:"Which IoT layer gathers sensor data?",opts:["Application","Network","Perception","Transport"],ans:2,exp:"Perception Layer = bottom layer physically sensing via RFID, ZigBee, BLE, etc."},
  {id:13,lec:"L10",sec:"Knowledge",q:"In a Sybil Attack, a node:",opts:["Floods the network","Pretends to be multiple nodes","Encrypts all traffic","Destroys routing physically"],ans:1,exp:"One node creates multiple fake identities, corrupting distributed algorithms."},
  {id:14,lec:"L11",sec:"Knowledge",q:"SaaS means:",opts:["Storage as a Service","Software as a Service","Security as a Service","System as a Service"],ans:1,exp:"SaaS = cloud-delivered ready software. CSP manages everything."},
  {id:15,lec:"L11",sec:"Knowledge",q:"3 root causes of cloud security problems?",opts:["Cost, Speed, Uptime","Loss of Control, Lack of Trust, Multi-Tenancy","Bandwidth, Latency, Throughput","Compliance, Governance, Auditing"],ans:1,exp:"Loss of Control, Lack of Trust, Multi-Tenancy."},
  {id:16,lec:"L12",sec:"Knowledge",q:"NIST CSF 2.0 Core Functions count:",opts:["4","5","6","7"],ans:2,exp:"6: Govern, Identify, Protect, Detect, Respond, Recover."},
  {id:17,lec:"L12",sec:"Knowledge",q:"Which function is NEW in NIST CSF 2.0?",opts:["Identify","Protect","Govern","Recover"],ans:2,exp:"Govern was added in v2.0 for strategic leadership-level risk management."},
  {id:18,lec:"L13",sec:"Knowledge",q:"CCA Thailand B.E.:",opts:["2545","2550","2560","2562"],ans:1,exp:"CCA B.E. 2550 (2007) was Thailand's first computer crime law."},
  {id:19,lec:"L13",sec:"Knowledge",q:"PDPA Data Controller notifies PDPC within:",opts:["24 hrs","48 hrs","72 hrs","7 days"],ans:2,exp:"PDPA Section 37: 72 hours after becoming aware of breach."},
  {id:20,lec:"L13",sec:"Knowledge",q:"Data Controller under PDPA:",opts:["Processes data per instructions","Decides purpose/means of data processing","Is always a government body","Is the data subject's employer"],ans:1,exp:"Controller decides WHY and HOW data is processed — bears primary legal liability."},
  {id:21,lec:"L7",sec:"Understanding",q:"Why is Stored XSS more dangerous than Reflected XSS?",opts:["Stored requires root access","Stored is saved in DB and executes for every visitor automatically","Reflected affects more browsers","They're equally dangerous"],ans:1,exp:"Stored XSS is persistent — every visitor to the infected page runs the attacker's script automatically."},
  {id:22,lec:"L7",sec:"Understanding",q:"CSRF works because:",opts:["Users have weak passwords","Browsers auto-send session cookies to the target domain","Servers don't use HTTPS","SQL queries are unparameterized"],ans:1,exp:"Browsers attach session cookies automatically to every request, making forged form submissions appear legitimate."},
  {id:23,lec:"L8",sec:"Understanding",q:"Why is Amplification effective with minimal attacker bandwidth?",opts:["It bypasses firewalls","Small spoofed request → disproportionately large response to victim","It encrypts traffic","It targets applications"],ans:1,exp:"1 small request → large response flooding the victim. Attacker spends minimal bandwidth."},
  {id:24,lec:"L9",sec:"Understanding",q:"Why is Application-Level Gateway more secure than Packet Filter for web?",opts:["It's faster","Inspects actual HTTP body content, catching SQLi/XSS headers-only filters miss","It's cheaper","No configuration needed"],ans:1,exp:"Packet filters see only headers. App gateways inspect Layer 7 content enabling detection of application-layer attacks."},
  {id:25,lec:"L10",sec:"Understanding",q:"Why are Passive WSN attacks harder to detect than Active?",opts:["Passive uses encryption","Passive generates no anomalous traffic — only observes","Passive comes from outside","Passive uses zero-days"],ans:1,exp:"Eavesdropping doesn't add or modify traffic. IDS systems looking for anomalies have nothing to detect."},
  {id:26,lec:"L11",sec:"Understanding",q:"Why does Multi-Tenancy create side-channel attack risk?",opts:["Network bandwidth is shared","Tenants share physical CPU/cache — timing can leak crypto keys","CSPs log all traffic","VMs use same OS"],ans:1,exp:"Shared physical hardware means CPU caches can be exploited via timing measurements to extract keys from co-resident VMs."},
  {id:27,lec:"L12",sec:"Understanding",q:"Why choose PT over VA for deeper security evaluation?",opts:["PT is cheaper","PT actively exploits real weaknesses and finds unknown paths VA misses","PT is automated","PT is more frequent"],ans:1,exp:"VA finds known, catalogued vulnerabilities. PT actually attacks — finding logic flaws and unknown weaknesses scanners miss."},
  {id:28,lec:"L13",sec:"Understanding",q:"Why does PDPA treat health data differently?",opts:["Health data is larger","Sensitive data misuse can cause severe discrimination and harm","It's an EU requirement","Health data is harder to encrypt"],ans:1,exp:"Sensitive categories (health, religion, criminal records) require explicit consent as a higher bar to protect against serious harm."},
  {id:29,lec:"L7",sec:"Analysis",q:"Bank database is leaking via string-concatenated SQL queries. Root cause?",opts:["Broken Access Control","SQL Injection — unparameterized queries","XSS vulnerability","CSRF attack"],ans:1,exp:"String-concatenated queries allow injected SQL. Fix: Prepared Statements."},
  {id:30,lec:"L7",sec:"Analysis",q:"User logs in to bank, opens malicious page, money transferred. Attack?",opts:["SQL Injection","XSS","CSRF/XSRF","Phishing"],ans:2,exp:"CSRF: malicious page sends forged transfer using active banking session cookie."},
  {id:31,lec:"L8",sec:"Analysis",q:"Server hit by millions of packets from thousands of IPs. Defense at this stage?",opts:["Patch OS","Attack Detection and Filtering","Increase RAM","Apply IDS rules"],ans:1,exp:"Attack in progress → Detection & Filtering phase. Identify and filter attack traffic."},
  {id:32,lec:"L9",sec:"Analysis",q:"SOC needs to auto-block zero-days inline without analyst approval. Best?",opts:["IDS only","Honeypot","Inline IPS","Packet Filter"],ans:2,exp:"Inline IPS blocks automatically. IDS only alerts. Packet filter lacks Layer 7 visibility."},
  {id:33,lec:"L10",sec:"Analysis",q:"IoT node advertises best route, then drops all routed packets. Attack?",opts:["Sinkhole","Blackhole","Wormhole","Sybil"],ans:1,exp:"Blackhole: attracts traffic by claiming best path, then silently drops all packets."},
  {id:34,lec:"L11",sec:"Analysis",q:"Company wants no vendor lock-in at cost of higher complexity. Best model?",opts:["Private Cloud","Public Cloud","Hybrid Cloud","Multicloud"],ans:3,exp:"Multicloud uses multiple CSPs — no single-vendor dependency but higher governance complexity."},
  {id:35,lec:"L12",sec:"Analysis",q:"Ransomware takes all systems offline for 2 weeks. Most relevant NIST functions?",opts:["Govern→Identify","Identify→Protect","Respond→Recover","Protect→Detect"],ans:2,exp:"Active incident: Respond = contain/eradicate; Recover = restore systems. Most immediate post-attack functions."},
  {id:36,lec:"L13",sec:"Analysis",q:"Breach exposes patient health records. Who notifies PDPC and when?",opts:["Data Processor, 24 hrs","Data Controller, 72 hrs","Data Subject, 48 hrs","IT Manager, 7 days"],ans:1,exp:"Data Controller makes the official report. PDPA Section 37: 72 hours."},
  {id:37,lec:"L13",sec:"Analysis",q:"Developer accesses competitor's code without authorization but copies nothing. Under CCA?",opts:["Legal — nothing taken","Illegal — unauthorized access is an offense regardless of intent","Illegal only if financial gain","Legal for research"],ans:1,exp:"CCA Section 5 criminalizes unauthorized access itself — intent and whether anything was taken are irrelevant."},
  {id:38,lec:"L9",sec:"Analysis",q:"A Honeypot captures rich attacker data. What is the main security risk?",opts:["Too many false positives","Attacker pivots from honeypot to real production systems","Consumes too much bandwidth","Alerts attackers to defenses"],ans:1,exp:"Poorly isolated honeypot can be used as a staging ground to move laterally into real systems."},
  {id:39,lec:"L12",sec:"Analysis",q:"CISO wants quarterly routine checks without external consultants. Best approach?",opts:["Penetration Testing","Vulnerability Assessment","Red Team Exercise","Social Engineering Test"],ans:1,exp:"VA = automated tools, in-house, quarterly. PT = external experts 1-2×/year for deep validation."},
  {id:40,lec:"L11",sec:"Analysis",q:"Why is blocking DDoS at the victim's network edge often ineffective?",opts:["Routers too slow","Upstream bandwidth already exhausted before reaching victim's edge","Edge routers lack ACLs","Zombie IPs whitelisted"],ans:1,exp:"Upstream bandwidth consumed before victim's edge devices can filter. Need upstream ISP cooperation."},
];

const SA_BASE=[
  {id:1,lec:"L7",diff:"Easy",q:"In 1-2 sentences, explain SQL Injection and name one prevention method.",rubric:"Must mention: injecting SQL via input fields to manipulate queries. Prevention: parameterized queries/prepared statements."},
  {id:2,lec:"L7",diff:"Easy",q:"What is the difference between Stored XSS and Reflected XSS?",rubric:"Stored: saved in DB, affects all visitors. Reflected: in URL, requires victim to click crafted link."},
  {id:3,lec:"L7",diff:"Medium",q:"A user logs into their bank, then a malicious tab triggers a money transfer. Name this attack and explain why it works.",rubric:"CSRF. Works because browsers automatically send session cookies with requests to the domain."},
  {id:4,lec:"L7",diff:"Medium",q:"Explain SSL/TLS purpose and what it does NOT protect.",rubric:"Encrypts data in transit. Does NOT protect: data at rest on server, compromised endpoints, socket addresses."},
  {id:5,lec:"L8",diff:"Easy",q:"Explain how SYN Flood works in 2-3 sentences.",rubric:"Sends SYN without ACK → half-open connections → connection table fills → server refuses new connections."},
  {id:6,lec:"L8",diff:"Medium",q:"What is an Amplification Attack? Give one example protocol.",rubric:"Small spoofed request → large response to victim. DNS or NTP amplification."},
  {id:7,lec:"L9",diff:"Easy",q:"Key operational difference between IDS and IPS?",rubric:"IDS: passive, monitors and alerts only. IPS: inline, monitors AND automatically blocks malicious traffic."},
  {id:8,lec:"L9",diff:"Medium",q:"Why is Stateful Inspection Firewall more secure than a Packet Filter?",rubric:"Tracks connection state table (IP, port, TCP seq). Verifies packets in legitimate sessions. Prevents hijacking/spoofing better than stateless inspection."},
  {id:9,lec:"L10",diff:"Easy",q:"Name the 3 IoT Architecture layers and describe each briefly.",rubric:"Perception: gathers sensor data (RFID, ZigBee). Network: transmits data. Application: processes and presents data."},
  {id:10,lec:"L10",diff:"Medium",q:"Describe the difference between Blackhole, Sinkhole, and Wormhole attacks in WSN.",rubric:"Blackhole: drops all packets. Sinkhole: lures traffic as best route then manipulates. Wormhole: secret tunnel replaying packets across network."},
  {id:11,lec:"L11",diff:"Easy",q:"Describe IaaS, PaaS, and SaaS with one example each.",rubric:"IaaS: VMs/storage (AWS EC2). PaaS: dev platform (Heroku). SaaS: software (Gmail, Office 365)."},
  {id:12,lec:"L11",diff:"Medium",q:"What are the 3 root causes of cloud security problems? Explain each.",rubric:"Loss of Control (no physical access), Lack of Trust (rely on CSP without verification), Multi-tenancy (shared hardware risks)."},
  {id:13,lec:"L12",diff:"Easy",q:"List all 7 components of a Security Plan.",rubric:"Policy, Current State, Requirements, Recommended Controls, Accountability, Timetable, Continuing Attention. All 7 required."},
  {id:14,lec:"L12",diff:"Medium",q:"Compare VA and PT. When would you use each?",rubric:"VA: automated, quarterly, in-house, known vulns. PT: manual exploit, 1-2×/year, external experts, unknown paths. VA = routine; PT = deep validation."},
  {id:15,lec:"L13",diff:"Medium",q:"Explain the roles of Data Controller and Data Processor under PDPA.",rubric:"Controller: decides purpose/means, bears primary liability. Processor: processes per Controller's instructions, not independent decision-maker."},
  {id:16,lec:"L13",diff:"Hard",q:"What does PDPA Section 26 classify as Sensitive Personal Data and what is the collection rule?",rubric:"Sensitive: racial/ethnic, political, religious, sexual behavior, criminal, health, disability, trade union, genetic, biometric. Rule: prohibited without explicit consent, limited exceptions."},
];

/* ═══════════════════════════════════════════════════════════
   AI HELPER
═══════════════════════════════════════════════════════════ */
async function aiCall(prompt) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{role:"user",content:prompt}] })
    });
    const d = await r.json();
    return d.content?.[0]?.text || "";
  } catch { return ""; }
}

/* ═══════════════════════════════════════════════════════════
   SMALL COMPONENTS
═══════════════════════════════════════════════════════════ */
const Badge=({lec,tag})=>{const c=LC[lec]||{lt:"#f1f5f9",tx:"#475569",br:"#e2e8f0"};return<span style={{background:c.lt,color:c.tx,border:`1px solid ${c.br}`}}className="inline-flex gap-1 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">{lec}·{tag}</span>;};
const Stars=({n})=><span className="text-yellow-400 text-sm select-none">{"★".repeat(n)}{"☆".repeat(3-n)}</span>;
const DiffBadge=({d})=>{const s=d==="Easy"?{bg:"#d1fae5",tx:"#065f46"}:d==="Medium"?{bg:"#fef3c7",tx:"#78350f"}:{bg:"#fee2e2",tx:"#7f1d1d"};return<span style={{background:s.bg,color:s.tx}}className="text-xs font-bold px-2 py-0.5 rounded-full">{d}</span>;};
const inp="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-400 bg-white transition-all text-slate-800";

/* ═══════════════════════════════════════════════════════════
   SCORE RING
═══════════════════════════════════════════════════════════ */
function ScoreRing({pct,size=56,stroke=5,label}) {
  const r = (size-stroke*2)/2, circ = 2*Math.PI*r;
  const dash = circ * pct/100;
  const color = pct>=80?"#10b981":pct>=60?"#f59e0b":"#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{transition:"stroke-dasharray 0.6s ease"}}/>
      </svg>
      <div className="text-center" style={{marginTop:-size*0.72,marginBottom:size*0.15}}>
        <div className="font-black text-slate-800" style={{fontSize:size*0.22}}>{pct}%</div>
      </div>
      {label&&<span className="text-xs text-slate-500 font-semibold">{label}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD TAB
═══════════════════════════════════════════════════════════ */
function Dashboard({progress,onReset}) {
  const modes = [
    {key:"quiz",icon:"✏️",label:"MCQ Quiz",color:"#6d28d9"},
    {key:"tf",icon:"✅",label:"True/False",color:"#059669"},
    {key:"sa",icon:"✍️",label:"Short Answer",color:"#0284c7"},
  ];

  const totalQ = (progress.quiz.totalAnswered||0)+(progress.tf.totalAnswered||0)+(progress.sa.totalAnswered||0);
  const totalC = (progress.quiz.totalCorrect||0)+(progress.tf.totalCorrect||0)+(progress.sa.totalCorrect||0);
  const overallPct = totalQ>0?Math.round(totalC/totalQ*100):0;

  return (
    <div className="space-y-5">
      {/* Overall */}
      <div className="rounded-3xl p-5 text-white" style={{background:"linear-gradient(135deg,#6d28d9,#db2777)"}}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-black text-xl">Your Progress</h2>
            <p className="text-violet-200 text-sm">All sessions combined</p>
          </div>
          <ScoreRing pct={overallPct} size={72} stroke={6}/>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl p-3 text-center" style={{background:"rgba(255,255,255,0.15)"}}>
            <div className="font-black text-2xl">{totalQ}</div>
            <div className="text-xs text-violet-200">Answered</div>
          </div>
          <div className="rounded-2xl p-3 text-center" style={{background:"rgba(255,255,255,0.15)"}}>
            <div className="font-black text-2xl">{totalC}</div>
            <div className="text-xs text-violet-200">Correct</div>
          </div>
          <div className="rounded-2xl p-3 text-center" style={{background:"rgba(255,255,255,0.15)"}}>
            <div className="font-black text-2xl">{(progress.cards?.totalSeen)||0}</div>
            <div className="text-xs text-violet-200">Cards Seen</div>
          </div>
        </div>
      </div>

      {/* Per-mode */}
      <div className="grid grid-cols-3 gap-3">
        {modes.map(m=>{
          const d=progress[m.key]||{};
          const pct=d.totalAnswered>0?Math.round(d.totalCorrect/d.totalAnswered*100):0;
          return(
            <div key={m.key} className="rounded-2xl border border-slate-100 bg-white p-4 flex flex-col items-center gap-2 shadow-sm">
              <span className="text-2xl">{m.icon}</span>
              <ScoreRing pct={pct} size={52} stroke={5}/>
              <span className="text-xs font-bold text-slate-600 text-center leading-tight">{m.label}</span>
              <span className="text-xs text-slate-400">{d.totalCorrect||0}/{d.totalAnswered||0}</span>
            </div>
          );
        })}
      </div>

      {/* Attempt History */}
      {["quiz","tf","sa"].some(k=>progress[k]?.attempts?.length>0)&&(
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <h3 className="font-black text-slate-700 mb-3">📈 Session History</h3>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {["quiz","tf","sa"].flatMap(k=>(progress[k]?.attempts||[]).map(a=>({...a,mode:k})))
              .sort((a,b)=>new Date(b.date)-new Date(a.date))
              .slice(0,20)
              .map((a,i)=>{
                const icons={quiz:"✏️",tf:"✅",sa:"✍️"};
                const pct=Math.round(a.score/a.total*100);
                const col=pct>=80?"#059669":pct>=60?"#d97706":"#dc2626";
                return(
                  <div key={i} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-base">{icons[a.mode]}</span>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-700">{a.label||a.mode.toUpperCase()}</div>
                      <div className="text-xs text-slate-400">{new Date(a.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-sm" style={{color:col}}>{a.score}/{a.total}</div>
                      <div className="text-xs" style={{color:col}}>{pct}%</div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Per-lecture breakdown */}
      {Object.keys(progress.lecStats||{}).length>0&&(
        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <h3 className="font-black text-slate-700 mb-3">📚 By Lecture</h3>
          <div className="space-y-2">
            {Object.entries(progress.lecStats).map(([lec,stat])=>{
              const c=LC[lec]||{bg:"#475569"};
              const pct=stat.total>0?Math.round(stat.correct/stat.total*100):0;
              return(
                <div key={lec} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0" style={{background:c.bg}}>{lec.replace("L","")}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700">{LNAMES[lec]}</span>
                      <span className="font-bold" style={{color:pct>=80?"#059669":pct>=60?"#d97706":"#dc2626"}}>{stat.correct}/{stat.total}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all" style={{width:`${pct}%`,background:c.bg}}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button onClick={onReset} className="w-full py-3 rounded-2xl border-2 border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 hover:border-red-200 hover:text-red-500 transition-all">
        🗑️ Reset All Progress
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FLASHCARD TAB
═══════════════════════════════════════════════════════════ */
function FCTab({progress,setProgress}) {
  const [cards,setCards]=useState(()=>shuffle(FC_BASE));
  const [cur,setCur]=useState(0);
  const [flipped,setFlipped]=useState(false);
  const [lec,setLec]=useState("All");
  const [known,setKnown]=useState(new Set(progress.cards?.known||[]));
  const [aiMsg,setAiMsg]=useState(""); const [aiLoad,setAiLoad]=useState(false);
  const wasComplete=useRef(false);

  const list=lec==="All"?cards:cards.filter(c=>c.lec===lec);
  const card=list[cur]||null;

  const saveKnown=(newSet)=>{
    setProgress(p=>{const n={...p,cards:{...p.cards,known:[...newSet],totalSeen:(p.cards?.totalSeen||0)+1}};saveProgress(n);return n;});
  };

  const autoGen=async()=>{
    setAiLoad(true);setAiMsg("🤖 Generating new flashcards…");
    const raw=await aiCall(`Create 5 NEW flashcard Q&A about Computer System Security L7-L13. Respond ONLY with JSON:\n[{"lec":"L7","tag":"Web Security","q":"question","a":"concise answer","stars":2}]\nAll English, lec L7-L13, stars 1-3.`);
    try{const arr=JSON.parse(raw.replace(/```json|```/g,"").trim());
      const mx=Math.max(...cards.map(c=>c.id),0);
      setCards(p=>shuffle([...p,...arr.map((c,i)=>({...c,id:mx+i+1}))]));
      setAiMsg(`✨ ${arr.length} new cards added and reshuffled!`);
      wasComplete.current=false; setKnown(new Set());
    }catch{setAiMsg("⚠️ AI failed.");}
    setAiLoad(false);setTimeout(()=>setAiMsg(""),5000);
  };

  if(list.length>0&&known.size>=list.length&&!wasComplete.current){wasComplete.current=true;autoGen();}

  const go=d=>{setFlipped(false);setTimeout(()=>setCur(p=>(p+d+list.length)%list.length),120);};
  const tk=id=>{setKnown(p=>{const s=new Set(p);s.has(id)?s.delete(id):s.add(id);saveKnown(s);return s;});};
  const reshuf=()=>{setCards(p=>shuffle([...p]));setCur(0);setFlipped(false);};

  const c=card?LC[card.lec]||{}:{};
  const pct=list.length?Math.round(known.size/list.length*100):0;

  return(
    <div className="space-y-4">
      {aiMsg&&<div className="rounded-2xl p-3 text-center text-sm font-semibold" style={{background:aiLoad?"#ede9fe":"#d1fae5",color:aiLoad?"#4c1d95":"#064e3b"}}>{aiMsg}</div>}
      <div className="flex flex-wrap gap-1.5">
        {LECS.map(l=><button key={l} onClick={()=>{setLec(l);setCur(0);setFlipped(false);}} className="px-3 py-1 rounded-full text-xs font-bold transition-all border" style={{background:lec===l?(l==="All"?"#1e293b":LC[l]?.bg):"white",color:lec===l?"white":"#64748b",borderColor:lec===l?"transparent":"#e2e8f0"}}>{l==="All"?"📚 All":l}</button>)}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Card <b className="text-slate-700">{list.length?cur+1:0}</b>/{list.length}</span>
            <span>Known <b className="text-emerald-600">{known.size}</b>/{list.length} ({pct}%)</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2"><div className="h-2 rounded-full transition-all" style={{width:`${pct}%`,background:"linear-gradient(90deg,#6d28d9,#db2777)"}}/></div>
        </div>
        <button onClick={reshuf} className="shrink-0 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50" title="Shuffle">🔀</button>
      </div>
      {card?(
        <div className="cursor-pointer select-none" onClick={()=>setFlipped(f=>!f)} style={{perspective:"1000px"}}>
          <div style={{transformStyle:"preserve-3d",transition:"transform 0.45s ease",transform:flipped?"rotateY(180deg)":"rotateY(0deg)",position:"relative",minHeight:"220px"}}>
            <div style={{backfaceVisibility:"hidden",borderColor:c.br,borderWidth:2}} className="absolute inset-0 rounded-3xl bg-white p-6 flex flex-col justify-between shadow-xl">
              <div className="flex items-start justify-between gap-2"><Badge lec={card.lec} tag={card.tag}/><Stars n={card.stars}/></div>
              <p className="text-center text-slate-800 font-bold text-base leading-relaxed flex-1 flex items-center justify-center py-3">{card.q}</p>
              <p className="text-center text-xs text-slate-400">Tap to reveal answer</p>
            </div>
            <div style={{backfaceVisibility:"hidden",transform:"rotateY(180deg)",background:c.lt,borderColor:c.br,borderWidth:2}} className="absolute inset-0 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
              <div className="flex items-start justify-between gap-2"><Badge lec={card.lec} tag={card.tag}/><Stars n={card.stars}/></div>
              <p style={{color:c.tx}} className="text-center font-semibold text-sm leading-relaxed flex-1 flex items-center justify-center py-3">{card.a}</p>
              <p className="text-center text-xs text-slate-400">Tap to flip back</p>
            </div>
          </div>
        </div>
      ):(
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 flex flex-col items-center gap-3">
          <span className="text-4xl">🃏</span><p className="text-slate-500 text-sm">No cards here</p>
        </div>
      )}
      {card&&(
        <div className="flex items-center gap-2">
          <button onClick={()=>go(-1)} className="flex-1 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 text-sm">← Prev</button>
          <button onClick={()=>tk(card.id)} className="px-4 py-2.5 rounded-xl font-bold text-sm transition-all border-2" style={{background:known.has(card.id)?"#10b981":"white",color:known.has(card.id)?"white":"#10b981",borderColor:"#10b981"}}>
            {known.has(card.id)?"✅ Got it":"🔖 Got it!"}
          </button>
          <button onClick={()=>go(1)} className="flex-1 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 text-sm">Next →</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TRUE/FALSE TAB
═══════════════════════════════════════════════════════════ */
function TFTab({progress,setProgress}) {
  const [items,setItems]=useState(()=>shuffle(TF_BASE));
  const [answers,setAnswers]=useState({});
  const [lec,setLec]=useState("All");
  const [aiMsg,setAiMsg]=useState(""); const [aiLoad,setAiLoad]=useState(false);
  const wasComplete=useRef(false);
  const sessionSaved=useRef(false);

  const list=lec==="All"?items:items.filter(x=>x.lec===lec);
  const answered=list.filter(x=>answers[x.id]!==undefined).length;
  const correct=list.filter(x=>answers[x.id]===x.ans).length;
  const allDone=list.length>0&&answered===list.length;

  useEffect(()=>{
    if(allDone&&!sessionSaved.current){
      sessionSaved.current=true;
      const now=new Date().toISOString();
      setProgress(p=>{
        const newLecStats={...p.lecStats||{}};
        list.forEach(x=>{
          if(!newLecStats[x.lec])newLecStats[x.lec]={correct:0,total:0};
          newLecStats[x.lec].total++;
          if(answers[x.id]===x.ans)newLecStats[x.lec].correct++;
        });
        const n={...p,
          tf:{...p.tf,
            totalCorrect:(p.tf.totalCorrect||0)+correct,
            totalAnswered:(p.tf.totalAnswered||0)+answered,
            attempts:[...(p.tf.attempts||[]),{date:now,score:correct,total:answered,label:`T/F (${lec==="All"?"All":lec})`}]
          },
          lecStats:newLecStats
        };
        saveProgress(n);return n;
      });
    }
  },[allDone]);

  const autoGen=async()=>{
    setAiLoad(true);setAiMsg("🤖 Generating new T/F questions…");
    const raw=await aiCall(`Create 5 NEW True/False statements about Computer System Security L7-L13. Mix true and false. Respond ONLY with JSON:\n[{"lec":"L7","stmt":"statement","ans":true,"exp":"explanation"}]\nAll English.`);
    try{const arr=JSON.parse(raw.replace(/```json|```/g,"").trim());
      const mx=Math.max(...items.map(x=>x.id),0);
      setItems(p=>shuffle([...p,...arr.map((x,i)=>({...x,id:mx+i+1}))]));
      setAiMsg(`✨ ${arr.length} new questions added!`);
      wasComplete.current=false;setAnswers({});sessionSaved.current=false;
    }catch{setAiMsg("⚠️ AI failed.");}
    setAiLoad(false);setTimeout(()=>setAiMsg(""),5000);
  };

  if(allDone&&!wasComplete.current){wasComplete.current=true;autoGen();}

  const pick=(id,val)=>{
    if(answers[id]!==undefined)return;
    setAnswers(p=>({...p,[id]:val}));
  };
  const reset=()=>{setAnswers({});wasComplete.current=false;sessionSaved.current=false;setItems(p=>shuffle([...p]));};

  return(
    <div className="space-y-4">
      {aiMsg&&<div className="rounded-2xl p-3 text-center text-sm font-semibold" style={{background:aiLoad?"#ede9fe":"#d1fae5",color:aiLoad?"#4c1d95":"#064e3b"}}>{aiMsg}</div>}
      <div className="flex flex-wrap gap-1.5">
        {LECS.map(l=><button key={l} onClick={()=>{setLec(l);reset();}} className="px-3 py-1 rounded-full text-xs font-bold transition-all border" style={{background:lec===l?(l==="All"?"#1e293b":LC[l]?.bg):"white",color:lec===l?"white":"#64748b",borderColor:lec===l?"transparent":"#e2e8f0"}}>{l==="All"?"📚 All":l}</button>)}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-xs text-slate-500">Answered <b className="text-violet-700">{answered}</b>/{list.length}
          {answered>0&&<> · <b style={{color:correct/answered>=0.8?"#059669":correct/answered>=0.6?"#d97706":"#dc2626"}}>{correct}/{answered} ({Math.round(correct/answered*100)}%)</b></>}
        </div>
        <button onClick={reset} className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50">🔀 Shuffle</button>
      </div>
      {allDone&&list.length>0&&(
        <div className="rounded-2xl p-4 text-center border-2" style={{background:correct/list.length>=0.8?"#d1fae5":correct/list.length>=0.6?"#fef3c7":"#fee2e2",borderColor:correct/list.length>=0.8?"#10b981":correct/list.length>=0.6?"#f59e0b":"#ef4444"}}>
          <div className="text-3xl font-black">{correct}/{list.length} <span className="text-lg">({Math.round(correct/list.length*100)}%)</span></div>
          <div className="text-sm font-semibold mt-1">{correct/list.length>=0.8?"🎉 Excellent — saved to history!":correct/list.length>=0.6?"👍 Good — score saved!":"💪 Keep studying — score saved!"}</div>
        </div>
      )}
      {list.map((x,idx)=>{
        const chosen=answers[x.id];const locked=chosen!==undefined;const isRight=locked&&chosen===x.ans;const c=LC[x.lec]||{};
        return(
          <div key={x.id} className="rounded-2xl border-2 p-4 bg-white transition-all" style={{borderColor:!locked?"#e2e8f0":isRight?"#10b981":"#ef4444"}}>
            <div className="flex items-start gap-3 mb-3">
              <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black" style={{background:c.bg||"#475569"}}>{idx+1}</span>
              <div className="flex-1"><div className="mb-1"><Badge lec={x.lec} tag={LNAMES[x.lec]}/></div>
                <p className="text-slate-800 font-semibold text-sm leading-relaxed">{x.stmt}</p></div>
              {locked&&<span className="text-xl shrink-0">{isRight?"✅":"❌"}</span>}
            </div>
            <div className="flex gap-2 ml-10">
              {[true,false].map(v=>(
                <button key={String(v)} onClick={()=>pick(x.id,v)} className="flex-1 py-2.5 rounded-xl border-2 font-black text-sm transition-all"
                  style={{cursor:locked?"default":"pointer",background:locked?(v===x.ans?"#d1fae5":chosen===v?"#fee2e2":"#f8fafc"):chosen===v?(v?"#d1fae5":"#fee2e2"):"white",color:locked?(v===x.ans?"#065f46":chosen===v?"#7f1d1d":"#94a3b8"):chosen===v?(v?"#065f46":"#7f1d1d"):"#64748b",borderColor:locked?(v===x.ans?"#10b981":chosen===v?"#ef4444":"#f1f5f9"):chosen===v?(v?"#10b981":"#ef4444"):"#e2e8f0"}}>
                  {v?"TRUE":"FALSE"}{locked&&v===x.ans?" ✓":locked&&chosen===v&&v!==x.ans?" ✗":""}
                </button>
              ))}
            </div>
            {locked&&<div className="ml-10 mt-3 p-3 rounded-xl text-xs text-slate-700 leading-relaxed" style={{background:isRight?"#f0fdf4":"#fff7f7",border:`1px solid ${isRight?"#bbf7d0":"#fecaca"}`}}>💡 {x.exp}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   QUIZ TAB
═══════════════════════════════════════════════════════════ */
function QZTab({progress,setProgress}) {
  const [questions,setQuestions]=useState(()=>shuffle(QZ_BASE));
  const [answers,setAnswers]=useState({});
  const [locked,setLocked]=useState({});
  const [showExp,setShowExp]=useState({});
  const [lec,setLec]=useState("All");
  const [sec,setSec]=useState("All");
  const [aiMsg,setAiMsg]=useState(""); const [aiLoad,setAiLoad]=useState(false);
  const wasComplete=useRef(false);
  const sessionSaved=useRef(false);
  const SECS=["All","Knowledge","Understanding","Analysis"];

  const list=questions.filter(q=>(lec==="All"||q.lec===lec)&&(sec==="All"||q.sec===sec));
  const answered=list.filter(q=>locked[q.id]).length;
  const correct=list.filter(q=>locked[q.id]&&answers[q.id]===q.ans).length;
  const allDone=list.length>0&&answered===list.length;

  useEffect(()=>{
    if(allDone&&!sessionSaved.current){
      sessionSaved.current=true;
      const now=new Date().toISOString();
      setProgress(p=>{
        const newLecStats={...p.lecStats||{}};
        list.forEach(q=>{
          if(!newLecStats[q.lec])newLecStats[q.lec]={correct:0,total:0};
          newLecStats[q.lec].total++;
          if(answers[q.id]===q.ans)newLecStats[q.lec].correct++;
        });
        const n={...p,
          quiz:{...p.quiz,
            totalCorrect:(p.quiz.totalCorrect||0)+correct,
            totalAnswered:(p.quiz.totalAnswered||0)+answered,
            attempts:[...(p.quiz.attempts||[]),{date:now,score:correct,total:answered,label:`Quiz (${lec==="All"?"All":lec}${sec!=="All"?"/"+sec:""})`}]
          },
          lecStats:newLecStats
        };
        saveProgress(n);return n;
      });
    }
  },[allDone]);

  const autoGen=async()=>{
    setAiLoad(true);setAiMsg("🤖 Generating new questions…");
    const raw=await aiCall(`Create 5 NEW MCQ about Computer System Security L7-L13. Respond ONLY with JSON:\n[{"lec":"L7","sec":"Knowledge","q":"question","opts":["A","B","C","D"],"ans":0,"exp":"explanation"}]\nAll English, lec L7-L13, sec Knowledge/Understanding/Analysis, plausible distractors.`);
    try{const arr=JSON.parse(raw.replace(/```json|```/g,"").trim());
      const mx=Math.max(...questions.map(q=>q.id),0);
      setQuestions(p=>shuffle([...p,...arr.map((q,i)=>({...q,id:mx+i+1}))]));
      setAiMsg(`✨ ${arr.length} new questions added!`);
      wasComplete.current=false;sessionSaved.current=false;
    }catch{setAiMsg("⚠️ AI failed.");}
    setAiLoad(false);setTimeout(()=>setAiMsg(""),5000);
  };

  if(allDone&&!wasComplete.current){wasComplete.current=true;autoGen();}

  const pick=(qid,idx)=>{if(locked[qid])return;setAnswers(p=>({...p,[qid]:idx}));setLocked(p=>({...p,[qid]:true}));};
  const reset=()=>{setAnswers({});setLocked({});setShowExp({});wasComplete.current=false;sessionSaved.current=false;setQuestions(p=>shuffle([...p]));};

  const optStyle=(q,i)=>{
    if(!locked[q.id])return answers[q.id]===i?{border:"2px solid #6d28d9",background:"#ede9fe",color:"#4c1d95",fontWeight:700}:{border:"1px solid #e2e8f0",background:"white",color:"#334155"};
    if(i===q.ans)return{border:"2px solid #10b981",background:"#d1fae5",color:"#065f46",fontWeight:700};
    if(answers[q.id]===i)return{border:"2px solid #ef4444",background:"#fee2e2",color:"#7f1d1d",textDecoration:"line-through",opacity:0.8};
    return{border:"1px solid #f1f5f9",background:"#f8fafc",color:"#94a3b8"};
  };

  return(
    <div className="space-y-4">
      {aiMsg&&<div className="rounded-2xl p-3 text-center text-sm font-semibold" style={{background:aiLoad?"#ede9fe":"#d1fae5",color:aiLoad?"#4c1d95":"#064e3b"}}>{aiMsg}</div>}
      <div className="flex flex-wrap gap-1.5">
        {SECS.map(s=><button key={s} onClick={()=>{setSec(s);reset();}} className="px-3 py-1 rounded-full text-xs font-bold transition-all border" style={{background:sec===s?"#6d28d9":"white",color:sec===s?"white":"#64748b",borderColor:sec===s?"#6d28d9":"#e2e8f0"}}>{s==="All"?"🎯 All":s==="Knowledge"?"📖 Know":s==="Understanding"?"🧠 Understand":"⚡ Analyze"}</button>)}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {LECS.map(l=><button key={l} onClick={()=>{setLec(l);reset();}} className="px-2.5 py-0.5 rounded-full text-xs font-bold transition-all border" style={{background:lec===l?(l==="All"?"#1e293b":LC[l]?.bg):"white",color:lec===l?"white":"#64748b",borderColor:lec===l?"transparent":"#e2e8f0"}}>{l==="All"?"📚 All":l}</button>)}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-xs text-slate-500">Answered <b className="text-violet-700">{answered}</b>/{list.length}
          {answered>0&&<> · <b style={{color:correct/answered>=0.8?"#059669":"#d97706"}}>{correct}/{answered}</b></>}
        </div>
        <button onClick={reset} className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50">🔀 Shuffle</button>
      </div>
      {allDone&&list.length>0&&(
        <div className="rounded-2xl p-4 text-center border-2" style={{background:correct/list.length>=0.8?"#d1fae5":correct/list.length>=0.6?"#fef3c7":"#fee2e2",borderColor:correct/list.length>=0.8?"#10b981":correct/list.length>=0.6?"#f59e0b":"#ef4444"}}>
          <div className="text-3xl font-black">{correct}/{list.length} ({Math.round(correct/list.length*100)}%)</div>
          <div className="text-sm font-semibold mt-1">{correct/list.length>=0.8?"🎉 Excellent — saved!":correct/list.length>=0.6?"👍 Good — saved!":"💪 Keep going — saved!"}</div>
        </div>
      )}
      {list.map((q,idx)=>{
        const c=LC[q.lec]||{};
        return(
          <div key={q.id} className="rounded-2xl border-2 p-4 bg-white" style={{borderColor:!locked[q.id]?"#e2e8f0":answers[q.id]===q.ans?"#10b981":"#ef4444"}}>
            <div className="flex items-start gap-3 mb-3">
              <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black" style={{background:c.bg||"#475569"}}>{idx+1}</span>
              <div className="flex-1"><div className="flex items-center gap-2 mb-1 flex-wrap"><Badge lec={q.lec} tag={q.sec}/></div>
                <p className="text-slate-800 font-semibold text-sm leading-relaxed">{q.q}</p></div>
              {locked[q.id]&&<span className="text-xl shrink-0">{answers[q.id]===q.ans?"✅":"❌"}</span>}
            </div>
            <div className="grid gap-2 ml-10">
              {q.opts.map((opt,i)=>(
                <button key={i} onClick={()=>pick(q.id,i)} className="text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center justify-between" style={{...optStyle(q,i),cursor:locked[q.id]?"default":"pointer"}}>
                  <span><span className="font-bold mr-2">{["A","B","C","D"][i]}.</span>{opt}</span>
                  {locked[q.id]&&i===q.ans&&<span className="text-emerald-600 font-bold">✓</span>}
                  {locked[q.id]&&answers[q.id]===i&&i!==q.ans&&<span className="text-red-500 font-bold">✗</span>}
                </button>
              ))}
            </div>
            {locked[q.id]&&(
              <div className="ml-10 mt-2">
                <button onClick={()=>setShowExp(p=>({...p,[q.id]:!p[q.id]}))} className="text-xs font-semibold hover:underline" style={{color:"#6d28d9"}}>{showExp[q.id]?"▲ Hide":"▼ Explanation"}</button>
                {showExp[q.id]&&<div className="mt-2 p-3 rounded-xl text-xs text-slate-700 leading-relaxed" style={{background:"#f8fafc",border:"1px solid #e2e8f0"}}>💡 {q.exp}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SHORT ANSWER TAB
═══════════════════════════════════════════════════════════ */
function SATab({progress,setProgress}) {
  const [items]=useState(()=>shuffle(SA_BASE));
  const [answers,setAnswers]=useState({});
  const [results,setResults]=useState({});
  const [loading,setLoading]=useState({});
  const [lec,setLec]=useState("All");
  const [diff,setDiff]=useState("All");

  const list=items.filter(x=>(lec==="All"||x.lec===lec)&&(diff==="All"||x.diff===diff));

  const submit=async(x)=>{
    if(!answers[x.id]?.trim()||loading[x.id])return;
    setLoading(p=>({...p,[x.id]:true}));
    const raw=await aiCall(`Grade this student answer for a Computer System Security exam.
Question: "${x.q}"
Rubric: "${x.rubric}"
Answer: "${answers[x.id]}"
Respond ONLY with JSON, no markdown:
{"score":"X/5","verdict":"Excellent|Good|Partial|Poor","feedback":"2-3 sentences","missed":"missing key points or empty string"}`);
    try{
      const res=JSON.parse(raw.replace(/```json|```/g,"").trim());
      setResults(p=>({...p,[x.id]:res}));
      // save to progress
      const pts=parseInt(res.score)||0;
      setProgress(p=>{
        const newLecStats={...p.lecStats||{}};
        if(!newLecStats[x.lec])newLecStats[x.lec]={correct:0,total:0};
        newLecStats[x.lec].total++;
        if(pts>=3)newLecStats[x.lec].correct++;
        const n={...p,
          sa:{...p.sa,
            totalCorrect:(p.sa.totalCorrect||0)+(pts>=3?1:0),
            totalAnswered:(p.sa.totalAnswered||0)+1,
            attempts:[...(p.sa.attempts||[]),{date:new Date().toISOString(),score:pts,total:5,label:`SA ${x.lec} (${x.diff})`}]
          },
          lecStats:newLecStats
        };
        saveProgress(n);return n;
      });
    }catch{setResults(p=>({...p,[x.id]:{score:"?/5",verdict:"Error",feedback:"AI grading failed.",missed:""}}));}
    setLoading(p=>({...p,[x.id]:false}));
  };

  const vStyle=v=>({
    Excellent:{bg:"#d1fae5",tx:"#065f46",border:"#6ee7b7"},
    Good:{bg:"#e0f2fe",tx:"#0c4a6e",border:"#7dd3fc"},
    Partial:{bg:"#fef3c7",tx:"#78350f",border:"#fcd34d"},
    Poor:{bg:"#fee2e2",tx:"#7f1d1d",border:"#fca5a5"},
    Error:{bg:"#f1f5f9",tx:"#475569",border:"#e2e8f0"},
  }[v]||{bg:"#f1f5f9",tx:"#475569",border:"#e2e8f0"});

  return(
    <div className="space-y-4">
      <div className="rounded-2xl p-3 text-xs text-slate-600 font-medium" style={{background:"#ede9fe",border:"1px solid #c4b5fd"}}>
        🤖 <b>AI-Graded:</b> Type your answer → Check → Claude scores it + saves to your progress history.
      </div>
      <div className="flex flex-wrap gap-1.5">
        {LECS.map(l=><button key={l} onClick={()=>setLec(l)} className="px-3 py-1 rounded-full text-xs font-bold transition-all border" style={{background:lec===l?(l==="All"?"#1e293b":LC[l]?.bg):"white",color:lec===l?"white":"#64748b",borderColor:lec===l?"transparent":"#e2e8f0"}}>{l==="All"?"📚 All":l}</button>)}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["All","Easy","Medium","Hard"].map(d=><button key={d} onClick={()=>setDiff(d)} className="px-3 py-1 rounded-full text-xs font-bold transition-all border" style={{background:diff===d?"#6d28d9":"white",color:diff===d?"white":"#64748b",borderColor:diff===d?"#6d28d9":"#e2e8f0"}}>{d==="All"?"🎯 All":d}</button>)}
      </div>
      {list.map((x,idx)=>{
        const c=LC[x.lec]||{};const res=results[x.id];const vs=res?vStyle(res.verdict):null;
        return(
          <div key={x.id} className="rounded-2xl border-2 p-4 bg-white transition-all" style={{borderColor:res?vs?.border:"#e2e8f0"}}>
            <div className="flex items-start gap-3 mb-3">
              <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black" style={{background:c.bg||"#475569"}}>{idx+1}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap"><Badge lec={x.lec} tag={LNAMES[x.lec]}/><DiffBadge d={x.diff}/></div>
                <p className="text-slate-800 font-semibold text-sm leading-relaxed">{x.q}</p>
              </div>
            </div>
            <div className="ml-10 space-y-2">
              <textarea className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-violet-400 resize-none bg-white leading-relaxed transition-all" rows={4} placeholder="Type your answer here…" value={answers[x.id]||""} onChange={e=>setAnswers(p=>({...p,[x.id]:e.target.value}))} disabled={!!res}/>
              {!res?(
                <button onClick={()=>submit(x)} disabled={!answers[x.id]?.trim()||loading[x.id]} className="px-4 py-2 rounded-xl text-sm font-black transition-all" style={{background:answers[x.id]?.trim()?"linear-gradient(135deg,#6d28d9,#db2777)":"#e2e8f0",color:answers[x.id]?.trim()?"white":"#94a3b8"}}>
                  {loading[x.id]?"⏳ Grading…":"✅ Check Answer"}
                </button>
              ):(
                <div className="rounded-xl p-3 space-y-1.5" style={{background:vs?.bg,border:`1px solid ${vs?.border}`}}>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base" style={{color:vs?.tx}}>{res.score}</span>
                    <span className="font-bold text-sm px-2 py-0.5 rounded-full" style={{background:"rgba(255,255,255,0.7)",color:vs?.tx}}>{res.verdict}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{color:vs?.tx}}>{res.feedback}</p>
                  {res.missed&&<p className="text-xs font-semibold" style={{color:vs?.tx}}>📌 Missing: {res.missed}</p>}
                  <button onClick={()=>{setResults(p=>{const n={...p};delete n[x.id];return n;});setAnswers(p=>{const n={...p};delete n[x.id];return n;});}} className="text-xs font-bold underline opacity-60 hover:opacity-100" style={{color:vs?.tx}}>Try again</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════════════ */
export default function App() {
  const [tab,setTab]=useState("dash");
  const [progress,setProgress]=useState(()=>loadProgress()||initProgress());

  const resetProgress=()=>{
    if(window.confirm("Reset all progress data? This cannot be undone.")){
      const fresh=initProgress();
      saveProgress(fresh);
      setProgress(fresh);
    }
  };

  const TABS=[
    {id:"dash",icon:"📊",label:"Progress"},
    {id:"fc",  icon:"🃏",label:"Cards"},
    {id:"tf",  icon:"✅",label:"T/F"},
    {id:"sa",  icon:"✍️",label:"Explain"},
    {id:"qz",  icon:"✏️",label:"Quiz"},
  ];

  // overall pct for header ring
  const totalQ=(progress.quiz.totalAnswered||0)+(progress.tf.totalAnswered||0)+(progress.sa.totalAnswered||0);
  const totalC=(progress.quiz.totalCorrect||0)+(progress.tf.totalCorrect||0)+(progress.sa.totalCorrect||0);
  const overallPct=totalQ>0?Math.round(totalC/totalQ*100):0;

  return(
    <div className="min-h-screen" style={{background:"linear-gradient(135deg,#f0f4ff 0%,#fdf4ff 50%,#fff1f5 100%)"}}>
      <div className="sticky top-0 z-10" style={{background:"rgba(255,255,255,0.9)",backdropFilter:"blur(14px)",borderBottom:"1px solid #e2e8f0"}}>
        <div className="max-w-xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h1 className="font-black text-slate-800 text-base">Computer System Security</h1>
              <p className="text-xs text-slate-500">040613601 · L7–L13 · Progress tracked</p>
            </div>
            <div className="flex items-center gap-2">
              {totalQ>0&&(
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-8">
                    <svg width="32" height="32" style={{transform:"rotate(-90deg)"}}>
                      <circle cx="16" cy="16" r="12" fill="none" stroke="#e2e8f0" strokeWidth="4"/>
                      <circle cx="16" cy="16" r="12" fill="none" stroke={overallPct>=80?"#10b981":overallPct>=60?"#f59e0b":"#ef4444"} strokeWidth="4"
                        strokeDasharray={`${2*Math.PI*12*overallPct/100} ${2*Math.PI*12}`} strokeLinecap="round"/>
                    </svg>
                    <div style={{marginTop:-28,marginBottom:4}} className="text-center text-xs font-black text-slate-700">{overallPct}%</div>
                  </div>
                </div>
              )}
              <div className="flex gap-1">{["L7","L8","L9","L10","L11","L12","L13"].map(l=><div key={l} className="w-2 h-2 rounded-full" style={{background:LC[l]?.bg}}/>)}</div>
            </div>
          </div>
          <div className="flex gap-1 p-1 rounded-2xl" style={{background:"#f1f5f9"}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5" style={{background:tab===t.id?"white":"transparent",color:tab===t.id?"#1e293b":"#64748b",boxShadow:tab===t.id?"0 1px 4px rgba(0,0,0,0.09)":"none"}}>
                <span className="text-sm leading-none">{t.icon}</span>
                <span style={{fontSize:"10px"}}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-xl mx-auto px-4 py-5 pb-14">
        {tab==="dash"&&<Dashboard progress={progress} onReset={resetProgress}/>}
        {tab==="fc"  &&<FCTab progress={progress} setProgress={setProgress}/>}
        {tab==="tf"  &&<TFTab progress={progress} setProgress={setProgress}/>}
        {tab==="sa"  &&<SATab progress={progress} setProgress={setProgress}/>}
        {tab==="qz"  &&<QZTab progress={progress} setProgress={setProgress}/>}
      </div>
    </div>
  );
}