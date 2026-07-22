1. Install package
Run this command to install the required dependencies.
Details:
npm install @supabase/supabase-js
Code:
File: Code
```
npm install @supabase/supabase-js
```

2. Add Supabase UI components
Run this command to install the Supabase shadcn components.
Details:
npx shadcn@latest add @supabase/supabase-client-nextjs
Code:
File: Code
```
npx shadcn@latest add @supabase/supabase-client-nextjs
```

3. Set env variables
Add the following values to your env file.
Code:
File: .env.local
```
NEXT_PUBLIC_SUPABASE_URL=https://miyjncbkjdrmfeqjkmqa.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_Z9_jveQvz5ZBxOEvNEmdaA_B1-1tJUi
```

4. Check out more UI components
Add auth, realtime and storage functionality to your project
Details:
Explore supabase.com/ui

5. Install Agent Skills (Optional)
Agent Skills give AI coding tools ready-made instructions, scripts, and resources for working with Supabase more accurately and efficiently.
Details:
npx skills add supabase/agent-skills
Code:
File: Code
```
npx skills add supabase/agent-skills
```