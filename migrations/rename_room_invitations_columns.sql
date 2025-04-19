-- Alter room_invitations table to rename columns
ALTER TABLE room_invitations
RENAME COLUMN inviter_id TO sender_id;

ALTER TABLE room_invitations
RENAME COLUMN invitee_id TO receiver_id;