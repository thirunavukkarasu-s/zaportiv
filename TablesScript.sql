USE [Korvin]
GO

CREATE TABLE dbo.Categories (
    Id int IDENTITY(1,1) PRIMARY KEY,
    Name varchar(50) NOT NULL,
    Code varchar(50) NOT NULL
) ON [PRIMARY];
GO

CREATE TABLE dbo.Products (
    Id int IDENTITY(1,1) PRIMARY KEY,
    Name varchar(50) NOT NULL,
    Code varchar(20) NOT NULL,
    Description varchar(500) NULL,
    CategoryId int NULL,
    Price decimal(18, 2) NOT NULL,
    Availability int NOT NULL
) ON [PRIMARY];
GO

CREATE TABLE dbo.Roles (
    Id int IDENTITY(1,1) PRIMARY KEY,
    Name varchar(50) NOT NULL,
    Code varchar(50) NOT NULL
) ON [PRIMARY];
GO

CREATE TABLE dbo.Users (
    Id int IDENTITY(1,1) PRIMARY KEY,
    Name varchar(50) NOT NULL,
    RoleId int NOT NULL,
    [Password] varchar(255) NOT NULL
) ON [PRIMARY];
GO

ALTER TABLE [dbo].[Products]  WITH CHECK ADD  CONSTRAINT [FK_Products_Categories] FOREIGN KEY([CategoryId])
REFERENCES [dbo].[Categories] ([Id])
GO
ALTER TABLE [dbo].[Products] CHECK CONSTRAINT [FK_Products_Categories]
GO


ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [FK_Users_Roles] FOREIGN KEY([RoleId])
REFERENCES [dbo].[Roles] ([Id])
GO
ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [FK_Users_Roles]
GO
