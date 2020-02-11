select * from accounts
delete from accounts

CREATE TABLE accounts(
  id VARCHAR(64) PRIMARY KEY UNIQUE NOT NULL,
  cipher VARCHAR DEFAULT NULL
)