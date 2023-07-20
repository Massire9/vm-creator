"use client";
import {supabase} from "@/utils/supabase";
import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import axios from 'axios'
import {FaSpinner} from "react-icons/fa";
import {TbCircleFilled} from "react-icons/tb";
import {RiShutDownLine} from "react-icons/ri";
import moment from "moment";
const Manage = () => {
    const [credit, setCredit] = useState(0)
    const [vms, setVms] = useState(null)
    const [isCreating, setIsCreating] = useState(false)
    const router = useRouter()

    useEffect(() => {
        const fetchRole = async () => {
            try {
                const { data: { user: { id} } } = await supabase.auth.getUser()

                const { data: [{credit}] , error: errr } = await supabase
                    .from('user_has_credit')
                    .select('credit')
                    .eq('user_id', id)


                const { data: [ ...vm] } = await supabase.from('virtual_machine').select('*').eq('user_id', id).order('created_at', { ascending: false })

                setCredit(credit)
                setVms(vm)
            } catch (e) {
                console.log('error : ', e)
            }
        }

        fetchRole()
    }, [])
    const handleDisconnect = async () => {
        await supabase.auth.signOut()

        router.push('/')
    }

    const createVm = async () => {
        try {
            setIsCreating(true)
            const { data: { user: { email, id} } } = await supabase.auth.getUser()
            const [username, ...rest] = email.split('@')
            const {data: { data } } = await axios.post('/api/manage', { id: (await supabase.auth.getUser()).data.user.id, username })
            const { data: [{credit}] , error: errr } = await supabase
                .from('user_has_credit')
                .select('credit')
                .eq('user_id', id)
            await supabase.from('user_has_credit').update({ credit: credit - 10 }).eq('user_id', id)

            setVms(data)
            setCredit((val) => val - 10)
            setIsCreating(false)
        } catch (err) {
            console.log(err)
            setIsCreating(false)
        }
    }
    return (
        <div className="p-2">
            <div className="flex flex-col mb-4">
                <div className="self-end text-white px-3 py-2 bg-red-500 rounded hover:bg-red-700"><button className="flex" onClick={() => handleDisconnect()}><RiShutDownLine className="my-auto mr-2 hover:animate-ping"/>Disconnect</button></div>
            </div>
            <div>
                Vous pouvez créer { credit >= 0 ? credit / 10 : '∞'} machine{credit > 10 || credit < 0 ? 's' : ''} virtuelle{credit > 10 || credit < 0 ? 's' : ''}.
                <div className="float-right">
                    <button className="px-3 py-2 border border-black disabled:bg-gray-400 hover:bg-gray-300 rounded" disabled={isCreating || (credit < 10 && credit >= 0)} onClick={() => createVm()}>
                        {isCreating ? (<div className="flex"> <FaSpinner className="my-auto mr-1 animate-spin hover:cursor-pointer"/> Création en cours</div>) : 'Ajouter une VM'}
                    </button>
                </div>
            </div>

            <div>
                <div className="text-2xl font-bold">Vos machines virtuelles</div>
                <div className="flex flex-col">
                    <div className="flex flex-row">
                        <div className="border border-black flex-1 rounded p-2 m-2">ip</div>
                        <div className="border border-black flex-1 rounded p-2 m-2">login</div>
                        <div className="border border-black flex-1 rounded p-2 m-2">mot de passe</div>
                        <div className="border border-black rounded flex-1 p-2 m-2">expiration</div>
                        <div className="border border-black rounded flex-none w-16 p-2 m-2">état</div>
                    </div>
                    {isCreating &&
                        (
                            <div className="flex flex-row">
                                <div className="border border-black rounded flex-1 p-2 m-2">Création en cours...</div>
                                <div className="border border-black rounded flex-none w-16 p-2 m-2"><FaSpinner className="m-auto top-1 animate-spin" /></div>
                            </div>
                        )
                    }
                    {vms ? vms.map((vm) =>(
                        <div className="flex flex-row" key={vm.id}>
                            <div className="border border-black rounded flex-1 p-2 m-2">{vm.ip}</div>
                            <div className="border border-black rounded flex-1 p-2 m-2">{vm.login}</div>
                            <div className="border border-black rounded flex-1 p-2 m-2">{vm.password}</div>
                            <div className="border border-black rounded flex-1 p-2 m-2">{moment(vm.expire_at).format("D/MM/yyyy - HH:mm")}</div>
                            <div className="border border-black rounded flex-none w-16 p-2 m-2"><TbCircleFilled className="mx-auto" color={ new Date(vm.expire_at) < new Date() ? 'red' : 'green' } /></div>
                        </div>
                        )
                    ) :
                        <div className="mx-auto"><FaSpinner className="mr-1 top-1 animate-spin" size="48" /></div>
                    }
                </div>
            </div>
        </div>
    );
}

export default Manage;