"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { supabase } from '@/utils/supabase'
export default function Home() {
    const  [email, setEmail] = useState("");
    const  [password, setPassword] = useState("");
    const  [error, setError] = useState("");
    //const supabase = createClientComponentClient()


    const router = useRouter()

    useEffect(() => {
        if(!supabase) return
        const fetchSession = async () => {
            const { data: { user } } = await supabase.auth.getUser()

            console.log(user)
            if(user) {
                router.push('/manage')
            }
        }

        fetchSession()

    }, [router])
    const handleSubmit = async (event) => {
        event.preventDefault()
        const { data: user, error } = await supabase.auth.signInWithPassword({ email, password })
        if(error) {
            setError('Invalid email or password')
            return
        }
        router.push('/manage')
    }

    return (
        <div className="flex h-screen">
            <div className="rounded p-2 m-auto w-6/12 border border-slate-500">
                <h1 className="text-2xl font-bold m-auto p-2">Log in</h1>
                <div>
                    <div className="text-red-600">
                        {error}
                    </div>
                    <div className="flex flex-col p-3">
                        <div>Email</div>
                        <input id="email" className="p-2 border-black border rounded mt-1" type="email" placeholder="e-mail" onChange={(e) => setEmail(e.target.value)}/>
                    </div>
                    <div className="flex flex-col p-3">
                        <div>Password</div>
                        <input id="password" className="p-2 border-black border rounded mt-1" type="password" placeholder="password" onChange={(e) => setPassword(e.target.value)}/>
                    </div>
                    <div className="p-2 mx-auto w-fit">
                        <button className="py-2 px-4 border border-black rounded hover:bg-gray-200" onClick={handleSubmit}>Log in</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
