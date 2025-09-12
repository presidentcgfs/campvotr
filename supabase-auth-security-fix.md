# Supabase Authentication Security Fix

## Problem

The application was using `supabase.auth.getSession()` which returns unverified data from cookies. This is insecure because:

- The session data comes directly from the storage medium (cookies)
- It may not be authentic and could be tampered with
- Supabase explicitly warns against using this for authentication decisions

## Solution

Updated the authentication flow to use `supabase.auth.getUser()` which:

- Makes a network request to the Supabase Auth server
- Verifies the session is authentic
- Returns validated user data

## Changes Made

### 1. Created safeGetSession helper in src/supabase/server.ts

```typescript
export async function safeGetSession(supabase: ReturnType<typeof createSupabaseServer>) {
	// Get the user from the auth server (validated)
	const {
		data: { user },
		error
	} = await supabase.auth.getUser();

	if (error || !user) {
		return { session: null, user: null };
	}

	// Only get the session after we've validated the user
	const {
		data: { session }
	} = await supabase.auth.getSession();

	return { session, user };
}
```

### 2. Updated hooks.server.ts

**Before:**

```typescript
const {
	data: { session }
} = await supabase.auth.getSession();
const user = session?.user ?? null;
```

**After:**

```typescript
// Use the safe method to get validated session and user
const { session, user } = await safeGetSession(supabase);
event.locals.session = session;
event.locals.user = user;
```

### 3. src/routes/auth/callback/+page.svelte

**Before:**

```typescript
const { data, error: authError } = await supabase.auth.getSession();
if (data.session) {
	goto('/dashboard');
}
```

**After:**

```typescript
const {
	data: { user },
	error: authError
} = await supabase.auth.getUser();
if (user) {
	goto('/dashboard');
}
```

### 4. src/lib/stores/auth.ts

**Before:**

```typescript
AuthService.getSession().then((currentSession) => {
	user.set(currentSession?.user);
	session.set(currentSession ?? undefined);
});
```

**After:**

```typescript
AuthService.getCurrentUser().then((currentUser) => {
	user.set(currentUser ?? undefined);
	if (currentUser) {
		AuthService.getSession().then((currentSession) => {
			session.set(currentSession ?? undefined);
		});
	}
});
```

### 5. src/lib/auth.ts

Added deprecation notice to `getSession()`:

```typescript
/**
 * @deprecated Use getCurrentUser() instead for security.
 * getSession() returns unverified data from cookies which may not be authentic.
 * Only use this if you need the session object specifically and will validate it separately.
 */
static async getSession() { ... }
```

## Best Practices Applied

1. **Server-side (hooks.server.ts)**:
   - Still use `getSession()` for initial retrieval (performance)
   - Validate with `getUser()` for authentication decisions
   - Store validated user in locals for downstream use

2. **Client-side**:
   - Prefer `getUser()` over `getSession()` for security
   - Only use `getSession()` when you specifically need the session object and will validate separately

3. **Auth State Management**:
   - Initialize with `getCurrentUser()` for secure verification
   - Only fetch session after confirming valid user
   - Clear session when no valid user exists

## Security Benefits

✅ **Verified Authentication**: All authentication decisions now based on server-verified data
✅ **Protection Against Token Tampering**: Cookies can't be manipulated to gain unauthorized access
✅ **Consistent Security Model**: Same validation approach across server and client
✅ **Performance Optimized**: Still uses fast cookie check first, then validates when needed

## References

- [Supabase Auth Security Issue #873](https://github.com/supabase/auth-js/issues/873)
- [Supabase SvelteKit Server-side Auth Guide](https://supabase.com/docs/guides/auth/server-side/sveltekit)
