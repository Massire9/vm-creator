import createResources from "@/utils/azure";

import {NextRequest, NextResponse} from 'next/server'
import { supabase } from "@/utils/supabase";

export async function POST(request){
    try {
        const body = await request.json()
        const {id, username} = body
        const { ip, username: login, password } = await createResources(username)
        await supabase
            .from('virtual_machine')
            .insert({ ip, user_id: id, login, password, expire_at: new Date(Date.now() + 1000 * 60 * 10) })

        const vm = await supabase
            .from('virtual_machine')
            .select('*')
            .eq('user_id', id)
            .order('created_at', { ascending: false })

        return NextResponse.json(vm)
    } catch (error) {
        console.log(error)
        return NextResponse.error(error)
    }

    

}