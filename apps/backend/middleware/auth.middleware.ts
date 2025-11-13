import type {Request,Response,NextFunction} from 'express';
import {verifySessionToken} from '../lib/jwt_manager';
import {verifySession} from '../lib/session_manager';

//extract jwt from authorization header
// extracts sessionId from jwt
//fetch user session and attach user to request

export async function authenticateUser(req:Request,res:Response,next:NextFunction):Promise<void>{
    try{
        const authHeader = req.headers.authorization;
        if(!authHeader){
            res.status(401).json({
                error : 'Unauthorized',
                message:'No authorization header provided',
                code:'NO_AUTHENTICATION_HEADER'
            });
            return;
        }
        if(!authHeader.startsWith('Bearer ')){
            res.status(401).json({
                error:'Unauthorized',
                message:'Invalid authorization header format',
                code:'INVALID_AUTHENTICATION_FORMAT'
            })
            return;
        }
        const token = authHeader.split(' ')[1];
        if(!token){
            res.status(401).json({
                error:'Unauthorized',
                message:'No authentication token provided',
                code:'NO_TOKEN_PROVIDED'
            })
            return;
        }
        let decoded;
        try{
            decoded = verifySessionToken(token);
        }catch(error){
            console.log(error);
            res.status(401).json({
                message:"Invalid Token or session expired"
            });
            return;
        }
        let session;
        try{
            session = await verifySession(decoded.sessionId);
        }catch(error){
            console.error('Session verification failed');
            res.status(401).json({
                message:"Session not found or expired"
            });
            return;
        }
        req.user = {
            userId : session.userId,
            username : session.username,
            email : session.email,
            name : session.name,
            avatar : session.avatar,
            profileUrl : session.profileUrl,
            sessionId : session.sessionId,
            githubAccessToken : session.githubAccessToken,
            createdAt : session.createdAt,
            expiredAt : 
            session.expiredAt
        };
        console.log(`[Auth Middleware] User authenticated ${session.username} (${session.userId})`);
        next();
    }catch(error){
        console.error('Authentication error',error);
        res.status(500).json({
            message : "Authentication failed due to internal server error"
        });
    }
}