-- Function callable only by the admin user to list all auth.users
-- Returns all users with profile data where available
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  full_name text,
  phone text,
  company_name text,
  company_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    p.full_name,
    p.phone,
    c.name AS company_name,
    cm.company_id
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.company_members cm ON cm.user_id = u.id
  LEFT JOIN public.companies c ON c.id = cm.company_id
  ORDER BY u.created_at DESC;
END;
$$;

-- Grant execute only to authenticated users (we guard by email in the app)
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
