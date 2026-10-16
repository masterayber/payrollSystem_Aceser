//Test-only secret, so tests never depend on the developer's .env
process.env.JWT_SECRET = "test_secret_that_is_at_least_32_characters_long";
