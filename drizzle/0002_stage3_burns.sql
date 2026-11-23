ALTER TABLE "burns" ADD COLUMN "burner" text;--> statement-breakpoint
CREATE INDEX "burns_at_idx" ON "burns" USING btree ("at");--> statement-breakpoint
CREATE INDEX "burns_burner_idx" ON "burns" USING btree ("burner");