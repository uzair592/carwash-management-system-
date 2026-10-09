-- Preserve personnel and financial relationships. Only two account types log in.
UPDATE "users" SET "role"='Accountant', "session_version"="session_version"+1
WHERE "role" IN ('Manager','Cashier');
-- Workshop staff remain assignable; remove obsolete login credentials only.
UPDATE "users" SET "password_hash"=NULL, "pin_code"='', "session_version"="session_version"+1
WHERE "role"='Worker';
-- Retain former investor records/history while disabling their old login.
UPDATE "users" SET "is_active"=false, "session_version"="session_version"+1
WHERE "role"='Investor';
