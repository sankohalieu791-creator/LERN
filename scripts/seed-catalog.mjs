/**
 * Seeds the course/workshop catalog: demo instructor accounts, 110 courses
 * (each with a weekly session plan + project day) and 50 online workshops.
 *
 * Run from the `lern` directory:  node scripts/seed-catalog.mjs
 *
 * Writes scripts/.seed-manifest.json with every id it created, so the whole
 * batch can be removed again with scripts/unseed-catalog.mjs.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Demo instructors ────────────────────────────────────────────────────────
const INSTRUCTORS = [
  { username: 'Dr. Amara Okonkwo',  title: 'Professor of Mathematics',    role: 'professor', topic: 'Mathematics' },
  { username: 'Ravi Subramanian',   title: 'Senior Software Engineer',    role: 'teacher',   topic: 'Computer Science' },
  { username: 'Elena Kowalski',     title: 'Data Scientist',              role: 'coach',     topic: 'Data & AI' },
  { username: 'Marcus Bell',        title: 'Business & Finance Coach',    role: 'coach',     topic: 'Business' },
  { username: 'Dr. Yuki Tanaka',    title: 'Lecturer in Life Sciences',   role: 'professor', topic: 'Science' },
  { username: 'Sofia Herrera',      title: 'Language Teacher',            role: 'teacher',   topic: 'Languages' },
  { username: 'James Whitfield',    title: 'Creative Director',           role: 'mentor',    topic: 'Design & Creative' },
  { username: 'Nadia Rahman',       title: 'Clinical Educator',           role: 'teacher',   topic: 'Health' },
  { username: 'Tom Ellery',         title: 'Trades & Engineering Tutor',  role: 'teacher',   topic: 'Engineering' },
  { username: 'Grace Adeyemi',      title: 'Careers & Skills Mentor',     role: 'mentor',    topic: 'Personal Development' },
  { username: 'Daniel Vasquez',     title: 'Cybersecurity Practitioner',  role: 'teacher',   topic: 'Technology' },
  { username: 'Priya Chandran',     title: 'Humanities Lecturer',         role: 'professor', topic: 'Humanities' },
]

// ── Course catalog: [subject, title, level, description] ────────────────────
const L = ['beginner', 'intermediate', 'advanced']
const CATALOG = [
  // Mathematics
  ['Mathematics', 'GCSE Maths: Algebra Foundations', 0, 'Master expanding, factorising and solving equations with confidence.'],
  ['Mathematics', 'A-Level Pure Maths: Calculus', 1, 'Differentiation, integration and their real applications.'],
  ['Mathematics', 'Linear Algebra for Engineers', 1, 'Vectors, matrices and transformations used in real engineering work.'],
  ['Mathematics', 'Probability & Statistics Essentials', 0, 'Distributions, sampling and how to reason under uncertainty.'],
  ['Mathematics', 'Discrete Maths for Computer Science', 1, 'Logic, sets, graphs and combinatorics underpinning CS.'],
  ['Mathematics', 'Mental Maths & Numeracy Bootcamp', 0, 'Fast, accurate arithmetic for exams and everyday life.'],
  ['Mathematics', 'Advanced Calculus & Series', 2, 'Sequences, convergence and multivariable techniques.'],
  ['Mathematics', 'Mathematical Proof & Reasoning', 2, 'Induction, contradiction and writing rigorous proofs.'],
  // Computer Science / Programming
  ['Computer Science', 'Python Programming from Scratch', 0, 'Write your first real programs — no experience needed.'],
  ['Computer Science', 'JavaScript Fundamentals', 0, 'The language of the web, taught properly from the ground up.'],
  ['Computer Science', 'Modern React & Next.js', 1, 'Build fast, production-grade web apps with React and Next.js.'],
  ['Computer Science', 'Data Structures & Algorithms', 1, 'The interview essentials — and why they actually matter.'],
  ['Computer Science', 'Object-Oriented Design in Java', 1, 'Classes, inheritance and designing systems that scale.'],
  ['Computer Science', 'C Programming & Memory', 2, 'Pointers, memory management and how computers really work.'],
  ['Computer Science', 'Rust for Systems Programming', 2, 'Safe, fast systems code with ownership and borrowing.'],
  ['Computer Science', 'Git & GitHub for Teams', 0, 'Branching, reviews and collaborating without breaking things.'],
  ['Computer Science', 'SQL & Relational Databases', 0, 'Query, join and model data like a professional.'],
  ['Computer Science', 'Building REST & GraphQL APIs', 1, 'Design, build and secure APIs that clients love.'],
  ['Computer Science', 'Test-Driven Development', 1, 'Write tests that catch real bugs and speed you up.'],
  ['Computer Science', 'Competitive Programming', 2, 'Problem-solving patterns for contests and hard interviews.'],
  // Data & AI
  ['Data Science', 'Data Analysis with Pandas', 0, 'Clean, reshape and interrogate real datasets in Python.'],
  ['Data Science', 'Data Visualisation & Storytelling', 0, 'Turn numbers into charts people actually understand.'],
  ['Data Science', 'Machine Learning Foundations', 1, 'Regression, classification and honest model evaluation.'],
  ['Data Science', 'Deep Learning with PyTorch', 2, 'Neural networks from tensors to training loops.'],
  ['Data Science', 'Natural Language Processing', 2, 'Embeddings, transformers and modern language models.'],
  ['Data Science', 'Building with LLMs', 1, 'Prompting, retrieval and shipping real AI-powered features.'],
  ['Data Science', 'Statistics for Data Science', 1, 'Inference, A/B testing and avoiding fooling yourself.'],
  ['Data Science', 'Excel to Analytics Pro', 0, 'From spreadsheets to genuine analytical firepower.'],
  ['Data Science', 'Big Data with Spark', 2, 'Distributed processing when your data stops fitting in memory.'],
  // Technology / Security / Infra
  ['Technology', 'Cybersecurity Fundamentals', 0, 'Threats, defences and thinking like an attacker.'],
  ['Technology', 'Ethical Hacking & Pen Testing', 2, 'Authorised offensive testing, responsibly taught.'],
  ['Technology', 'Network Engineering Basics', 0, 'TCP/IP, routing and how the internet actually moves data.'],
  ['Technology', 'Cloud Computing with AWS', 1, 'Compute, storage and networking on the cloud.'],
  ['Technology', 'DevOps & CI/CD Pipelines', 1, 'Ship safely and often with automation you can trust.'],
  ['Technology', 'Docker & Kubernetes', 1, 'Containerise and orchestrate real workloads.'],
  ['Technology', 'Linux Command Line Mastery', 0, 'Live in the terminal and never fear it again.'],
  ['Technology', 'iOS Development with Swift', 1, 'Design and ship your first App Store app.'],
  ['Technology', 'Android Development with Kotlin', 1, 'Modern Android apps, built the right way.'],
  ['Technology', 'Game Development with Unity', 1, 'From blank scene to a game people can play.'],
  ['Technology', 'Blockchain & Smart Contracts', 2, 'How chains work and how to write contracts safely.'],
  // Science
  ['Science', 'GCSE Physics: Forces & Motion', 0, 'Newton, momentum and energy made intuitive.'],
  ['Science', 'A-Level Chemistry: Organic', 1, 'Mechanisms, functional groups and synthesis routes.'],
  ['Science', 'Biology: Cells & Genetics', 0, 'DNA, inheritance and how life encodes itself.'],
  ['Science', 'Human Anatomy & Physiology', 1, 'Body systems and how they work together.'],
  ['Science', 'Astronomy & Cosmology', 0, 'Stars, galaxies and the scale of the universe.'],
  ['Science', 'Environmental Science & Climate', 0, 'The science behind the climate conversation.'],
  ['Science', 'Quantum Physics Explained', 2, 'Superposition and entanglement, without the hand-waving.'],
  ['Science', 'Neuroscience Foundations', 1, 'Neurons, circuits and the biology of behaviour.'],
  ['Science', 'Microbiology & Immunology', 1, 'Pathogens, immunity and how we fight infection.'],
  // Engineering
  ['Engineering', 'Electrical Engineering Basics', 0, 'Circuits, Ohm’s law and safe practical wiring.'],
  ['Engineering', 'Mechanical Engineering Principles', 1, 'Statics, dynamics and materials that hold up.'],
  ['Engineering', 'Robotics & Arduino', 0, 'Build and program robots that move and sense.'],
  ['Engineering', 'CAD & 3D Modelling', 0, 'Design parts and print them in the real world.'],
  ['Engineering', 'Civil Engineering & Structures', 1, 'Loads, beams and why buildings stay standing.'],
  ['Engineering', 'Renewable Energy Systems', 1, 'Solar, wind and storage — the engineering reality.'],
  ['Engineering', 'Electronics & PCB Design', 1, 'From breadboard to a board you can manufacture.'],
  // Business / Finance
  ['Business', 'Entrepreneurship: Zero to Launch', 0, 'Validate, build and launch a business that survives.'],
  ['Business', 'Financial Accounting Essentials', 0, 'Read a balance sheet and know what it’s telling you.'],
  ['Business', 'Personal Finance & Investing', 0, 'Budgets, compounding and long-term wealth building.'],
  ['Business', 'Marketing Strategy & Branding', 1, 'Positioning that makes customers choose you.'],
  ['Business', 'Digital Marketing & SEO', 0, 'Get found, get clicks, get customers.'],
  ['Business', 'Project Management & Agile', 0, 'Ship on time with Scrum, Kanban and sane planning.'],
  ['Business', 'Negotiation & Persuasion', 1, 'Get better outcomes without burning relationships.'],
  ['Business', 'Startup Fundraising', 1, 'Cap tables, pitch decks and talking to investors.'],
  ['Business', 'Business Analytics & KPIs', 1, 'Measure what matters and act on it.'],
  ['Business', 'Supply Chain & Operations', 1, 'Inventory, logistics and operational efficiency.'],
  ['Business', 'E-commerce Store Building', 0, 'Launch and grow an online store that converts.'],
  // Law / Humanities / Social
  ['Humanities', 'Introduction to Law', 0, 'Contract, tort and criminal law fundamentals.'],
  ['Humanities', 'Human Rights & Ethics', 1, 'Frameworks for reasoning about hard moral questions.'],
  ['Humanities', 'Modern World History', 0, 'The forces that shaped the century we live in.'],
  ['Humanities', 'Philosophy: Logic & Argument', 1, 'Spot bad reasoning and build good arguments.'],
  ['Humanities', 'Psychology Foundations', 0, 'Memory, behaviour and how the mind actually works.'],
  ['Humanities', 'Sociology & Society', 0, 'Class, culture and the structures around us.'],
  ['Humanities', 'Politics & Government', 0, 'How power is organised and contested.'],
  ['Humanities', 'Economics: Micro & Macro', 1, 'Markets, incentives and national economies.'],
  ['Humanities', 'Creative Writing Workshop', 0, 'Find your voice and finish what you start.'],
  ['Humanities', 'Academic Writing & Research', 1, 'Argue clearly and cite properly.'],
  ['Humanities', 'Public Speaking & Rhetoric', 0, 'Speak so people listen — and remember.'],
  // Languages
  ['Languages', 'Spanish for Beginners', 0, 'Speak useful Spanish from your first lesson.'],
  ['Languages', 'Intermediate Spanish Conversation', 1, 'Move from textbook to real fluency.'],
  ['Languages', 'French for Beginners', 0, 'Pronunciation, grammar and everyday conversation.'],
  ['Languages', 'Arabic: Reading & Writing', 0, 'The script, the sounds and your first sentences.'],
  ['Languages', 'Mandarin Chinese Basics', 0, 'Tones, characters and practical everyday phrases.'],
  ['Languages', 'German Grammar Intensive', 1, 'Cases and word order finally made logical.'],
  ['Languages', 'English as a Second Language', 0, 'Confidence in speaking, listening and writing.'],
  ['Languages', 'IELTS & TOEFL Preparation', 1, 'Target the score you actually need.'],
  ['Languages', 'British Sign Language Level 1', 0, 'Everyday BSL for genuine conversation.'],
  // Design & Creative
  ['Design & Creative', 'Graphic Design Principles', 0, 'Type, colour, hierarchy and composition.'],
  ['Design & Creative', 'UI/UX Design & Figma', 0, 'Design interfaces people find obvious to use.'],
  ['Design & Creative', 'Photography Masterclass', 0, 'Exposure, light and making photos that land.'],
  ['Design & Creative', 'Video Editing & Storytelling', 0, 'Cut footage into something people watch to the end.'],
  ['Design & Creative', 'Motion Graphics & Animation', 1, 'Bring static design to life.'],
  ['Design & Creative', 'Music Production & Mixing', 0, 'Record, arrange and mix a finished track.'],
  ['Design & Creative', 'Drawing & Illustration', 0, 'Fundamentals of form, line and shading.'],
  ['Design & Creative', 'Interior & Spatial Design', 1, 'Design rooms that work as well as they look.'],
  ['Design & Creative', 'Fashion Design Fundamentals', 0, 'Sketch, pattern and construct a garment.'],
  ['Design & Creative', 'Architecture & Sketching', 1, 'Read, draw and think about built space.'],
  // Health
  ['Health', 'First Aid & Emergency Response', 0, 'The skills to act correctly in the first five minutes.'],
  ['Health', 'Mental Health Awareness', 0, 'Recognise, respond and support with confidence.'],
  ['Health', 'Nutrition & Dietetics', 0, 'Evidence-based eating, free of the marketing noise.'],
  ['Health', 'Personal Training & Fitness', 0, 'Programme design, form and safe progression.'],
  ['Health', 'Yoga & Mobility', 0, 'Build strength and range you keep for life.'],
  ['Health', 'Safeguarding & Child Protection', 0, 'Duties, signs and the right escalation route.'],
  ['Health', 'Care Work Essentials', 0, 'Dignity, practical care and professional standards.'],
  ['Health', 'Pharmacology Basics', 1, 'How drugs act, interact and are dosed.'],
  // Personal development / teaching
  ['Personal Development', 'Study Skills & Exam Technique', 0, 'Revise less, remember more, perform on the day.'],
  ['Personal Development', 'CV, LinkedIn & Interviews', 0, 'Get shortlisted, then get the offer.'],
  ['Personal Development', 'Leadership & Management', 1, 'Lead a team without micromanaging it.'],
  ['Personal Development', 'Time Management & Focus', 0, 'Do the work that matters, consistently.'],
  ['Personal Development', 'Teaching & Lesson Planning', 1, 'Plan lessons that actually land with learners.'],
  ['Personal Development', 'Coaching & Mentoring Skills', 1, 'Ask better questions, unlock better thinking.'],
]

// ── Workshops: [title, description] ─────────────────────────────────────────
const WORKSHOPS = [
  ['Build a Portfolio Site in 2 Hours', 'Ship a live personal site by the end of the session.'],
  ['Intro to Python: Live Coding', 'Write and run your first Python program with help on hand.'],
  ['Debugging Like a Senior Engineer', 'A systematic method for finding bugs fast.'],
  ['Git Rescue: Undo Anything', 'Reset, revert, rebase — recover from any Git mess.'],
  ['SQL Query Clinic', 'Bring a query, leave with it working and fast.'],
  ['React Hooks Deep Dive', 'useState to useMemo, and when each is wrong.'],
  ['Your First Machine Learning Model', 'Train, evaluate and interpret a model live.'],
  ['Prompt Engineering for Real Work', 'Get consistent, useful output from LLMs.'],
  ['Data Cleaning in Pandas', 'Turn a messy CSV into something analysable.'],
  ['Charts That Don’t Lie', 'Visualisation choices that respect your data.'],
  ['Excel Power Hour', 'Lookups, pivots and formulas that save you days.'],
  ['Cybersecurity: Spot the Phish', 'Live examples and how to not get caught.'],
  ['Password & Account Security Clinic', 'Lock down your accounts properly, today.'],
  ['Intro to the Linux Terminal', 'Navigate, edit and script with confidence.'],
  ['Deploy Your App to the Cloud', 'From localhost to a public URL, live.'],
  ['Docker in One Session', 'Containerise an app from scratch.'],
  ['API Design Workshop', 'Design an API your future self won’t hate.'],
  ['Technical Interview Practice', 'Live problem-solving with real-time feedback.'],
  ['System Design Basics', 'Scale a simple app to a million users, on a whiteboard.'],
  ['Build a Chatbot Live', 'Wire up a working conversational assistant.'],
  ['Figma from Zero', 'Design your first screen in a single sitting.'],
  ['UX Critique Clinic', 'Bring your design, get honest structured feedback.'],
  ['Logo & Brand Identity Jam', 'Build a brand mark from concept to export.'],
  ['Photo Editing Masterclass', 'Edit a raw photo end to end.'],
  ['Video Editing Crash Course', 'Cut a rough clip into a watchable story.'],
  ['Music Production Live Session', 'Build a track from a blank project.'],
  ['Creative Writing Sprint', 'Write a complete short piece in one session.'],
  ['Public Speaking Practice Lab', 'Speak, get feedback, speak again — live.'],
  ['Pitch Your Startup', 'Deliver your pitch and get investor-style feedback.'],
  ['Fundraising Q&A with a Founder', 'Ask the awkward questions about raising money.'],
  ['Business Model Canvas Workshop', 'Map your whole business on one page.'],
  ['Marketing Funnel Teardown', 'We pull apart a real funnel and fix it.'],
  ['SEO Audit Live', 'Audit a real site and find the quick wins.'],
  ['Personal Finance Q&A', 'Budgeting, debt and investing — ask anything.'],
  ['Reading Financial Statements', 'Understand what the numbers actually say.'],
  ['CV & LinkedIn Review Clinic', 'Bring your CV, leave with it fixed.'],
  ['Mock Interview Session', 'A realistic interview, then honest feedback.'],
  ['Negotiating Your Salary', 'Scripts and tactics that actually work.'],
  ['Study Skills & Revision Lab', 'Build a revision plan that survives contact with reality.'],
  ['Exam Technique Workshop', 'Timing, structure and picking up the easy marks.'],
  ['Essay Writing Clinic', 'Structure an argument that earns top marks.'],
  ['Maths Problem-Solving Session', 'Work through hard problems together, live.'],
  ['Physics Problem Clinic', 'Bring the questions that are stumping you.'],
  ['Chemistry Mechanisms Live', 'Draw and reason through reaction mechanisms.'],
  ['Biology Revision Intensive', 'High-yield revision before the exam.'],
  ['Spanish Conversation Hour', 'Speak Spanish for a full hour, gently corrected.'],
  ['French Pronunciation Lab', 'Fix your accent with live coaching.'],
  ['English Speaking Practice', 'Build fluency and confidence out loud.'],
  ['Mindfulness & Stress Reset', 'Practical techniques you can use the same day.'],
  ['First Aid Live Demo', 'Watch and practise the responses that matter most.'],
]

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const pick = (a, i) => a[i % a.length]
const iso = d => d.toISOString().slice(0, 10)
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

const manifest = { instructors: [], courses: [], sessions: [], workshops: [] }
const today = new Date()

// ── 1. Instructors ──────────────────────────────────────────────────────────
console.log('Creating demo instructor accounts…')
const instructorIds = []
// Look up an existing auth user by email (createUser is not idempotent).
const findAuthUserByEmail = async email => {
  for (let page = 1; page <= 10; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    const hit = data?.users?.find(u => u.email === email)
    if (hit) return hit.id
    if (!data?.users?.length || data.users.length < 200) return null
  }
  return null
}

for (const ins of INSTRUCTORS) {
  const email = `${slug(ins.username)}@lernapp.uk`

  let id
  const { data: created, error: authErr } = await sb.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
  })
  if (authErr) {
    // Already registered from a previous run — reuse it.
    id = await findAuthUserByEmail(email)
    if (!id) { console.error(`  auth ${email}: ${authErr.message}`); continue }
  } else {
    id = created.user.id
  }

  // A trigger on auth.users auto-creates the public.users profile row, so update
  // that row rather than inserting a second one.
  const { error: pErr } = await sb.from('users').upsert([{
    id,
    email,
    username:         ins.username,
    avatar_url:       `https://i.pravatar.cc/300?u=${encodeURIComponent(email)}`,
    title:            ins.title,
    bio:              `${ins.title} teaching ${ins.topic} on LERN.`,
    account_type:     'instructor',
    is_instructor:    true,
    verified:         true,
    instructor_role:  ins.role,
  }], { onConflict: 'id' })
  if (pErr) { console.error(`  profile ${email}: ${pErr.message}`); continue }

  instructorIds.push(id)
  manifest.instructors.push({ id, email, username: ins.username })
  console.log(`  ✓ ${ins.username}`)
}

if (!instructorIds.length) { console.error('No instructors created — aborting.'); process.exit(1) }

// ── 2. Courses + sessions ───────────────────────────────────────────────────
console.log(`\nCreating ${CATALOG.length} courses…`)
let ci = 0
for (const [subject, title, levelIdx, description] of CATALOG) {
  const instructor_id = pick(instructorIds, ci)
  const sessionCount  = 4 + (ci % 5)                 // 4–8 sessions
  const start         = addDays(today, 5 + (ci % 45)) // starts 5–49 days out
  const end           = addDays(start, (sessionCount - 1) * 7)

  const { data: course, error } = await sb.from('courses').insert([{
    instructor_id,
    user_id:        instructor_id,
    title,
    description,
    subject,
    level:          L[levelIdx],
    duration_weeks: sessionCount,
    thumbnail_url:  `https://picsum.photos/seed/${slug(title)}/800/600`,
    start_date:     iso(start),
    end_date:       iso(end),
    visibility:     'public',
    rating:         0,
    enrolled_count: 0,
    is_deleted:     false,
  }]).select('id').single()

  if (error) { console.error(`  ✗ ${title}: ${error.message}`); ci++; continue }

  const sessions = []
  for (let s = 0; s < sessionCount; s++) {
    const isProject = s === sessionCount - 1
    sessions.push({
      course_id:        course.id,
      session_number:   s + 1,
      title:            isProject ? 'Project Day' : `Session ${s + 1}: ${title.split(':').pop().trim()}`,
      description:      isProject ? 'Submit your final project for review.' : null,
      session_date:     iso(addDays(start, s * 7)),
      session_time:     ['17:00:00', '18:00:00', '19:00:00', '10:00:00'][ci % 4],
      duration_minutes: [60, 90][ci % 2],
      is_live:          false,
      is_completed:     false,
      is_project_day:   isProject,
    })
  }
  const { data: made, error: sErr } = await sb.from('course_sessions').insert(sessions).select('id')
  if (sErr) console.error(`  ! sessions for ${title}: ${sErr.message}`)

  manifest.courses.push(course.id)
  for (const m of made ?? []) manifest.sessions.push(m.id)
  ci++
  if (ci % 20 === 0) console.log(`  …${ci}/${CATALOG.length}`)
}
console.log(`  ✓ ${manifest.courses.length} courses`)

// ── 3. Online workshops ─────────────────────────────────────────────────────
console.log(`\nCreating ${WORKSHOPS.length} online workshops…`)
let wi = 0
for (const [title, description] of WORKSHOPS) {
  const instructor_id = pick(instructorIds, wi + 3)
  const when = addDays(today, 3 + (wi % 40))

  const { data: w, error } = await sb.from('workshops').insert([{
    instructor_id,
    user_id:          instructor_id,
    title,
    description,
    thumbnail_url:    `https://picsum.photos/seed/${slug(title)}/800/600`,
    workshop_date:    iso(when),
    workshop_time:    ['12:00:00', '17:30:00', '18:30:00', '19:30:00'][wi % 4],
    is_online:        true,
    location:         null,
    max_participants: [25, 50, 100, 200][wi % 4],
    enrolled_count:   0,
    is_live:          false,
  }]).select('id').single()

  if (error) { console.error(`  ✗ ${title}: ${error.message}`); wi++; continue }
  manifest.workshops.push(w.id)
  wi++
}
console.log(`  ✓ ${manifest.workshops.length} workshops`)

fs.mkdirSync(path.dirname('scripts/.seed-manifest.json'), { recursive: true })
fs.writeFileSync('scripts/.seed-manifest.json', JSON.stringify(manifest, null, 2))

console.log(`\nDone.
  instructors: ${manifest.instructors.length}
  courses:     ${manifest.courses.length}
  sessions:    ${manifest.sessions.length}
  workshops:   ${manifest.workshops.length}
Manifest written to scripts/.seed-manifest.json (used by unseed-catalog.mjs).`)
