-- trip booking is a demo: phone numbers are no longer collected, and any stored ones are removed
ALTER TABLE bookings ALTER COLUMN phone DROP NOT NULL;
UPDATE bookings SET phone = NULL WHERE phone IS NOT NULL;
