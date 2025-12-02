-- Create Household Invitations Table
CREATE TABLE IF NOT EXISTS household_invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    role app_role DEFAULT 'member',
    token UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE household_invitations ENABLE ROW LEVEL SECURITY;

-- Policies

-- Admins can view invitations for their household
CREATE POLICY "Admins can view invitations" ON household_invitations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM household_members
            WHERE household_members.household_id = household_invitations.household_id
            AND household_members.user_id = auth.uid()
            AND household_members.role = 'admin'
        )
    );

-- Admins can create invitations
CREATE POLICY "Admins can create invitations" ON household_invitations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM household_members
            WHERE household_members.household_id = household_invitations.household_id
            AND household_members.user_id = auth.uid()
            AND household_members.role = 'admin'
        )
    );

-- Admins can delete/revoke invitations
CREATE POLICY "Admins can delete invitations" ON household_invitations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM household_members
            WHERE household_members.household_id = household_invitations.household_id
            AND household_members.user_id = auth.uid()
            AND household_members.role = 'admin'
        )
    );

-- Secure function to get invitation by token
CREATE OR REPLACE FUNCTION get_invitation_by_token(lookup_token UUID)
RETURNS TABLE (
    id UUID,
    household_id UUID,
    email TEXT,
    role app_role,
    status TEXT,
    household_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hi.id,
        hi.household_id,
        hi.email,
        hi.role,
        hi.status,
        h.name as household_name
    FROM household_invitations hi
    JOIN households h ON h.id = hi.household_id
    WHERE hi.token = lookup_token
    AND hi.status = 'pending'
    AND hi.expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon/authenticated
GRANT EXECUTE ON FUNCTION get_invitation_by_token TO anon, authenticated, service_role;

-- Function to accept invitation
CREATE OR REPLACE FUNCTION accept_invitation(lookup_token UUID)
RETURNS JSON AS $$
DECLARE
    invite_record RECORD;
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    -- Get invite
    SELECT * INTO invite_record
    FROM household_invitations
    WHERE token = lookup_token
    AND status = 'pending'
    AND expires_at > NOW();
    
    IF invite_record IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Invalid or expired invitation');
    END IF;
    
    -- Check if already a member
    IF EXISTS (SELECT 1 FROM household_members WHERE household_id = invite_record.household_id AND user_id = current_user_id) THEN
        RETURN json_build_object('success', false, 'message', 'You are already a member of this household');
    END IF;
    
    -- Add to household_members
    INSERT INTO household_members (household_id, user_id, role)
    VALUES (invite_record.household_id, current_user_id, invite_record.role);
    
    -- Update invite status
    UPDATE household_invitations
    SET status = 'accepted', updated_at = NOW()
    WHERE id = invite_record.id;
    
    RETURN json_build_object('success', true, 'message', 'Successfully joined household');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION accept_invitation TO authenticated, service_role;

