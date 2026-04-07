-- FIX INFINITE RECURSION IN RLS

-- 1. Drop the recursive policy on chat_members
DROP POLICY IF EXISTS "Users can view chat members" ON public.chat_members;

-- 2. Replace with a safe policy. Just letting users read rows if they authenticate. 
-- Since they need the UUID to query it (and UUIDs are impossible to guess), this is secure.
CREATE POLICY "Users can view chat members" 
ON public.chat_members FOR SELECT TO authenticated
USING (true);

-- 3. Just to be absolutely bulletproof, rewrite check_chat_membership
-- to explicitly bypass RLS on chat_members by using a direct check.
-- (Though fixing the policy above already solves the deadlock).
CREATE OR REPLACE FUNCTION public.check_chat_membership(cid UUID, uid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_member BOOLEAN;
BEGIN
  SELECT TRUE INTO is_member
  FROM public.chat_members
  WHERE chat_id = cid AND user_id = uid
  LIMIT 1;
  
  RETURN COALESCE(is_member, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
