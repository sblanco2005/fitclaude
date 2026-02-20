i am building this app with claude code
FitClaude — an AI-powered fitness assistant with conversational workout generation, nutrition tracking, and "spicy" exercise variation logic. Built with FastAPI + postgres nano(async) backend, Anthropic Claude API for the agent, and react js
one idea i have  is have a subagent that every night checks youtube videos and adds more exercises to my library in fact the subagent will have 2 jobs
search for more exercises and link the exercises that i already have to a youtube video the user can check  how to do the exercise 
Maybe very costly but what are your thoughts
8:27 PM
Cool idea — and it's actually not as costly as you might think if you design it right.
The YouTube search part is essentially free — you'd just hit the YouTube Data API v3 (10,000 quota units/day free tier). A search costs 100 units, so you get ~100 searches/day for free. That's more than enough for a nightly job.
The costly part is the Claude API calls, but you can minimize that:
Exercise discovery: You don't need Claude for this. Just search YouTube for exercise names you already have in your library + variations. Parse the video metadata (title, description, tags) programmatically. That's zero AI cost.
Linking existing exercises to videos: Same thing — search YouTube for your exercise name, grab the top result. Maybe use a simple fuzzy match or embedding similarity on the title. No LLM needed.
Where Claude adds value: Watching a new fitness channel's video titles/descriptions and extracting new exercises you don't have yet, categorizing them (muscle group, difficulty, equipment), and generating the metadata for your library. Even here, you could batch 50+ video titles into a single Sonnet call for pennies.
My suggested architecture:
Nightly cron job (no AI) — YouTube API search for each exercise in your DB → store best matching video URL + thumbnail
Weekly discovery job (light AI) — Search trending fitness channels → batch video titles into one Claude Sonnet/Haiku call → extract new exercises with metadata → insert into DB pending review
Use Haiku for the extraction, not Opus/Sonnet — it's more than capable for structured extraction and like 50x cheaper
Rough cost estimate: maybe $0.05–0.15/night for the AI portion if you batch smartly. The YouTube API is free.
One thing to think about — do you actually want fully automated additions, or would you prefer the subagent queues suggestions for you to approve? A review queue would prevent junk exercises from polluting your library.
yeah review page that i can only access
8:29 PM
Smart approach. Here's how I'd structure it:
Admin review flow:
Subagent runs nightly, writes candidates to a pending_exercises table with status pending
You get a /admin/review route (protected behind auth — even just a simple API key or your user ID check)
Each card shows: exercise name, muscle groups, equipment, difficulty, YouTube embed preview, source channel
You swipe approve/reject (or bulk actions). Approved ones get inserted into the main exercises table
For the video linking job (existing exercises → YouTube videos):
Same idea — subagent finds candidate videos, writes to a pending_video_links table
You review and confirm the match before it goes live to users
Simple auth for admin-only access:
Since you're already using FastAPI, you could just do something like:
python
@router.get("/admin/review")
async def review_page(user_id: str = Depends(get_current_user)):
    if user_id != ADMIN_USER_ID:
        raise HTTPException(403)
    ...
Or if you want it even simpler for now, just a secret URL path like /admin/{SECRET_KEY}/review — not bulletproof but fine for an MVP where you're the only admin.
DB-wise you'd just need two new tables:
pending_exercises — name, description, muscle_groups, equipment, difficulty, youtube_url, source, status, created_at
pending_video_links — exercise_id (FK), youtube_url, match_confidence, status, created_at
This keeps your main exercise library clean and gives you full control. Want me to help you scaffold the schema and the FastAPI routes for this?

Yes, the classification of "tutorial" vs "reference" is based on the video title. Here's exactly what happens in classify_video_type():

The function looks at the YouTube video title and checks for these signals:

Signal	Example Title	Result
Number > 1 + fitness keyword	"10 Best Back Exercises"	reference
Plural "exercises"	"Chest Exercises for Mass"	reference
Superlative + muscle group (without exercise name)	"Best Shoulder Workouts"	reference
Workout/training + muscle group (without exercise name)	"Leg Day Routine"	reference
Everything else	"How to Barbell Deadlift Proper Form"	tutorial
The key distinction: if the title contains the specific exercise name (e.g. "Deadlift"), it leans toward tutorial. If it's generic muscle group language with no specific exercise, it's reference.

This classification happens automatically when the Video Linker imports videos. You can still override it manually in the admin page by choosing "Tutorial" or "Reference" when approving.

