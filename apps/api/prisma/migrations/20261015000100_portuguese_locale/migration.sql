-- Add Portuguese without altering existing records or monetary/authentication data.
ALTER TYPE "locale" ADD VALUE IF NOT EXISTS 'pt';
