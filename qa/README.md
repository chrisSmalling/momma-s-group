# UI QA

The production UI audit is read-only. It uses a dedicated non-real QA identity and runs the protected UI through a normal Supabase session.

The Browserbase workflow waits for production to become reachable, authenticates, tests the current application routes, captures mobile screenshots, and fails the job when assertions fail.
